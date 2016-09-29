import Registry from './registry';
import BasePlugin from './basePlugin';
import DefaultIssuePlugin from './defaultIssuePlugin';

const registry = new Registry();

export {BasePlugin, registry, DefaultIssuePlugin};

export default {
    BasePlugin: BasePlugin,
    DefaultIssuePlugin: DefaultIssuePlugin,

    add: registry.add.bind(registry),
    get: registry.get.bind(registry),
    isLoaded: registry.isLoaded.bind(registry),
    load: registry.load.bind(registry),
    loadAll: registry.loadAll.bind(registry),
};
