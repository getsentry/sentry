import Registry from './registry';
import {BasePlugin} from './basePlugin';

const registry = new Registry();

export {BasePlugin, registry};

export default {
    get: registry.get.bind(registry),
    add: registry.add.bind(registry),
    BasePlugin: BasePlugin,
};
