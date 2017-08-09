import Registry from './registry';
import BasePlugin from './basePlugin';
import BaseContext from './baseContext';
import DefaultIssuePlugin from './defaultIssuePlugin';

const contexts = {};
const registry = new Registry();

export {BasePlugin, registry, DefaultIssuePlugin};

export default {
  BaseContext: BaseContext,
  BasePlugin: BasePlugin,
  DefaultIssuePlugin: DefaultIssuePlugin,

  add: registry.add.bind(registry),
  addContext: function(id, component) {
    contexts[id] = component;
  },
  contexts: contexts,
  get: registry.get.bind(registry),
  isLoaded: registry.isLoaded.bind(registry),
  load: registry.load.bind(registry),
  loadAll: registry.loadAll.bind(registry)
};
