#!/usr/bin/env python3
"""Deploy the static site to a remote server using SSH host aliases + SCP.

Usage examples:
    python deploy.py --host demo-box --remote-dir /var/www/chineseqa
    python deploy.py --host demo-box --remote-dir /var/www/chineseqa --dry-run
    python deploy.py --host demo-box --remote-dir /var/www/chineseqa --no-config
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
) -> None:
    """Deploy local static app files to a remote directory.

    Args:
        host_alias: SSH host alias from ~/.ssh/config (or Windows OpenSSH config).
        remote_dir: Absolute target directory on remote host.
        project_dir: Local project root folder.
        dry_run: Print commands only.
        include_config: Include config.js in deployment.
    """

    on_windows = sys.platform.startswith("win")
    ssh_exec = resolve_exec("ssh.exe", "ssh") if on_windows else resolve_exec("ssh")
    scp_exec = resolve_exec("scp.exe", "scp") if on_windows else resolve_exec("scp")

    project_dir = project_dir.resolve()
    if not project_dir.exists():
        raise DeployError(f"Project directory not found: {project_dir}")

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
        )
    except (DeployError, subprocess.CalledProcessError) as exc:
        print(f"Deploy failed: {exc}")
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
