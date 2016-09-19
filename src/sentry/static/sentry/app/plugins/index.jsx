import Registry from './registry';
import BasePlugin from './basePlugin';

const registry = new Registry();

export {BasePlugin, registry};

export default {
    BasePlugin: BasePlugin,

    add: registry.add.bind(registry),
    get: registry.get.bind(registry),
    isLoaded: registry.isLoaded.bind(registry),
    load: registry.load.bind(registry),
    loadAll: registry.loadAll.bind(registry),
};
