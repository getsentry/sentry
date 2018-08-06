import Registry from 'app/plugins/registry';
import BasePlugin from 'app/plugins/basePlugin';
import BaseContext from 'app/plugins/baseContext';
import DefaultIssuePlugin from 'app/plugins/defaultIssuePlugin';

const contexts = {};
const registry = new Registry();

export {BasePlugin, registry, DefaultIssuePlugin};

export default {
  BaseContext,
  BasePlugin,
  DefaultIssuePlugin,

  add: registry.add.bind(registry),
  addContext: function(id, component) {
    contexts[id] = component;
  },
  contexts,
  get: registry.get.bind(registry),
  isLoaded: registry.isLoaded.bind(registry),
  load: registry.load.bind(registry),
  loadAll: registry.loadAll.bind(registry),
};
