import BasePlugin from 'app/plugins/basePlugin';

class DefaultPlugin extends BasePlugin {
  static displayName = 'DefaultPlugin';
  //should never be be callsed
  renderGroupActions() {
    return null;
  }
}

export {DefaultPlugin};
