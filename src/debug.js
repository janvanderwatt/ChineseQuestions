// Debug panel helper

(function initAppDebug(global) {
  class AppDebug {
    constructor(options = {}) {
      this.rootId = options.rootId || 'debug-panel-root';
      this.enabled = Boolean(options.enabled);
      this.applyVisibility();
    }

    setEnabled(enabled) {
      this.enabled = Boolean(enabled);
      this.applyVisibility();
    }

    applyVisibility() {
      const root = document.getElementById(this.rootId);
      if (!root) {
        return;
      }

      root.hidden = !this.enabled;
      if (!this.enabled) {
        root.open = false;
      }
    }

    update(section, value) {
      if (!this.enabled) {
        return;
      }

      const target = document.getElementById(`debug-${section}`);
      if (!target) {
        return;
      }

      if (typeof value === 'string') {
        target.textContent = value;
        return;
      }

      try {
        target.textContent = JSON.stringify(value, null, 2);
      } catch (_error) {
        target.textContent = String(value);
      }
    }
  }

  global.AppDebug = AppDebug;
}(window));
