import BasePlugin from 'sentry/plugins/basePlugin';

class DefaultPlugin extends BasePlugin {
  static displayName = 'DefaultPlugin';
  // should never be called since this is a non-issue plugin
  renderGroupActions() {
    return null;
  }
}

export {DefaultPlugin};
