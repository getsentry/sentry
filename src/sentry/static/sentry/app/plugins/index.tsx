import Registry from 'app/plugins/registry';
import BasePlugin from 'app/plugins/basePlugin';
import DefaultIssuePlugin from 'app/plugins/defaultIssuePlugin';

import SessionStackPlugin from './sessionstack';
import SessionStackContextType from './sessionstack/contexts/sessionstack';
import Jira from './jira';

const contexts: Record<string, React.ElementType> = {};
const registry = new Registry();

// Register legacy plugins

// Sessionstack
registry.add('sessionstack', SessionStackPlugin);
contexts.sessionstack = SessionStackContextType;

// Jira
registry.add('jira', Jira);

export {BasePlugin, registry, DefaultIssuePlugin};

const add: typeof registry.add = registry.add.bind(registry);
const get: typeof registry.get = registry.get.bind(registry);
const isLoaded: typeof registry.isLoaded = registry.isLoaded.bind(registry);
const load: typeof registry.load = registry.load.bind(registry);

export default {
  BasePlugin,
  DefaultIssuePlugin,

  add,
  addContext: function (id: string, component: React.ElementType) {
    contexts[id] = component;
  },
  contexts,
  get,
  isLoaded,
  load,
};
