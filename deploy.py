#!/usr/bin/env python3
"""Deploy the static site to a remote server using SSH host aliases + SCP.

Usage examples:
    python deploy.py --host demo-box --remote-dir /var/www/chineseqa/public
    python deploy.py --host demo-box --remote-dir /var/www/chineseqa/public --dry-run
    python deploy.py --host demo-box --remote-dir /var/www/chineseqa/public --no-config

The remote directory is emptied before upload, so point --remote-dir at the
app's public directory, never at the app root (which usually also holds the
version dirs, a 'current' symlink and rate-limit state). The directory is
checked before the wipe and the deploy aborts if it holds anything other than
the files/folders being uploaded, unless --force is passed.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


class DeployError(RuntimeError):
    """Raised when deploy prerequisites or commands fail."""


def resolve_exec(*candidates: str) -> str:
    """Resolve first available executable path from candidate command names."""

    for candidate in candidates:
        resolved = shutil.which(candidate)
        if resolved:
            return resolved

    raise DeployError(f"Required executable not found: {', '.join(candidates)}")


def run_cmd(command: list[str], cwd: Path | None = None, dry_run: bool = False) -> None:
    printable = " ".join(command)
    location = f" (cwd={cwd})" if cwd else ""
    print(f"> {printable}{location}")

    if dry_run:
        return

    subprocess.run(command, cwd=str(cwd) if cwd else None, check=True)


def run_cmd_output(command: list[str]) -> str:
    """Run a read-only remote command and return its stdout."""

    print(f"> {' '.join(command)}")
    completed = subprocess.run(command, check=True, capture_output=True, text=True)
    return completed.stdout


def get_deploy_items(project_dir: Path, include_config: bool) -> list[Path]:
    """Resolve and validate files/folders that should be deployed."""

    items: list[Path] = [project_dir / "index.html", project_dir / "src", project_dir / "api"]
    if include_config:
        items.append(project_dir / "config.js")

    missing = [item for item in items if not item.exists()]
    if missing:
        missing_list = ", ".join(str(path) for path in missing)
        raise DeployError(f"Required deploy item(s) not found: {missing_list}")

    return items


def build_index_with_asset_versions(project_dir: Path, include_config: bool) -> str:
    """Return index.html content with CSS/JS URLs stamped by local file mtime."""

    index_path = project_dir / "index.html"
    content = index_path.read_text(encoding="utf-8")

    asset_paths = ["src/styles.css", "src/api.js", "src/debug.js", "src/app.js"]
    if include_config:
                asset_paths.append("config.js")

    for rel_path in asset_paths:
        asset = project_dir / rel_path
        if not asset.exists():
            continue

        version = int(asset.stat().st_mtime)
        content = content.replace(f'href="{rel_path}"', f'href="{rel_path}?v={version}"')
        content = content.replace(f'src="{rel_path}"', f'src="{rel_path}?v={version}"')

    return content


def deploy(
    host_alias: str,
    remote_dir: str,
    project_dir: Path = Path("."),
    dry_run: bool = False,
    include_config: bool = True,
    force: bool = False,
) -> None:
    """Deploy local static app files to a remote directory.

    Args:
        host_alias: SSH host alias from ~/.ssh/config (or Windows OpenSSH config).
        remote_dir: Absolute target directory on remote host.
        project_dir: Local project root folder.
        dry_run: Print commands only.
        include_config: Include config.js in deployment.
        force: Allow the wipe even when the target holds unexpected entries.
    """

    on_windows = sys.platform.startswith("win")
    ssh_exec = resolve_exec("ssh.exe", "ssh") if on_windows else resolve_exec("ssh")
    scp_exec = resolve_exec("scp.exe", "scp") if on_windows else resolve_exec("scp")

    project_dir = project_dir.resolve()
    if not project_dir.exists():
        raise DeployError(f"Project directory not found: {project_dir}")

    # Git Bash / MSYS rewrites a leading '/' in command-line arguments into a
    # Windows path, so '--remote-dir /home/me/app/public' can arrive here as
    # 'C:/Program Files/Git/home/me/app/public' and get created as junk on the
    # server. Reject anything that is not a plain POSIX absolute path.
    if not remote_dir.startswith("/"):
        raise DeployError(
            f"remote_dir must be an absolute POSIX path, got {remote_dir!r}. "
            "On Git Bash/MSYS a leading '/' in an argument gets rewritten to a "
            "Windows path; prefix the command with MSYS_NO_PATHCONV=1 or use "
            "the built-in default."
        )

    deploy_items = get_deploy_items(project_dir, include_config)

    temp_dir: tempfile.TemporaryDirectory[str] | None = None
    versioned_index_path: Path | None = None
    if (project_dir / "index.html").exists():
        temp_dir = tempfile.TemporaryDirectory()
        versioned_index_path = Path(temp_dir.name) / "index.html"
        versioned_index_path.write_text(
            build_index_with_asset_versions(project_dir, include_config),
            encoding="utf-8",
        )
    print("Deploying items:")
    for item in deploy_items:
        print(f"- {item}")

    remote_prepare = (
        "set -e; "
        f"mkdir -p {sh_quote(remote_dir)}; "
        f"find {sh_quote(remote_dir)} -mindepth 1 -maxdepth 1 -exec rm -rf -- {{}} +"
    )

    write_probe = (
        "set -e; "
        f"mkdir -p {sh_quote(remote_dir)}; "
        f"test -w {sh_quote(remote_dir)}"
    )
    try:
        run_cmd([ssh_exec, host_alias, write_probe], dry_run=dry_run)
    except subprocess.CalledProcessError as exc:
        fix_hint = (
            f"ssh {host_alias} \"sudo chown -R $(id -un):$(id -gn) {remote_dir}\""
        )
        raise DeployError(
            "Remote directory is not writable by the SSH user. "
            f"Target: {remote_dir}. "
            f"Run once to fix ownership, then retry: {fix_hint}"
        ) from exc

    # Safety rail: the next command deletes everything in remote_dir. Abort if
    # that directory holds entries this deploy did not put there -- pointing
    # --remote-dir at an app root would otherwise destroy the version dirs,
    # the 'current' symlink and the rate-limit counters.
    if not dry_run:
        listing = run_cmd_output(
            [ssh_exec, host_alias, f"set -e; mkdir -p {sh_quote(remote_dir)}; ls -A1 {sh_quote(remote_dir)}"]
        )
        allowed_names = {item.name for item in deploy_items}
        unexpected = sorted({line.strip() for line in listing.splitlines() if line.strip()} - allowed_names)
        if unexpected and not force:
            raise DeployError(
                f"Refusing to wipe {remote_dir}: it also contains {', '.join(unexpected)}. "
                "Point --remote-dir at the app's public directory (for example "
                ".../apps/<app>/v1/public), or pass --force if those entries really "
                "should be deleted."
            )

    run_cmd([ssh_exec, host_alias, remote_prepare], dry_run=dry_run)

    remote_target = f"{host_alias}:{remote_dir.rstrip('/')}/"
    for item in deploy_items:
        source_item = versioned_index_path if versioned_index_path and item.name == "index.html" else item

        if item.is_dir():
            run_cmd([scp_exec, "-r", str(item), remote_target], dry_run=dry_run)
            continue
        run_cmd([scp_exec, str(source_item), remote_target], dry_run=dry_run)

    if temp_dir:
        temp_dir.cleanup()

    print("Deploy complete.")


def sh_quote(value: str) -> str:
    """Single-quote for remote POSIX shell usage."""

    return "'" + value.replace("'", "'\"'\"'") + "'"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Deploy static site files via SSH/SCP.")
    parser.add_argument("--host", required=False, help="SSH host alias from your SSH config", default="lightcatorg-lightcatorg")
    parser.add_argument("--remote-dir", required=False, help="Remote directory to wipe and upload into", default="/home/lightcatorg/apps/chineseqa/v1/public")
    parser.add_argument(
        "--project-dir",
        default=".",
        help="Project root folder containing index.html/src/config.js (default: current dir)",
    )
    parser.add_argument(
        "--no-config",
        action="store_true",
        help="Do not upload config.js",
    )
    parser.add_argument("--dry-run", action="store_true", help="Print commands only")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Wipe the target even if it holds files this deploy did not upload",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        deploy(
            host_alias=args.host,
            remote_dir=args.remote_dir,
            project_dir=Path(args.project_dir),
            dry_run=args.dry_run,
            include_config=not args.no_config,
            force=args.force,
        )
    except (DeployError, subprocess.CalledProcessError) as exc:
        print(f"Deploy failed: {exc}")
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
