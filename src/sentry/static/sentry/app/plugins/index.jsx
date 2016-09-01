import Registry from './registry';
import {BasePlugin} from './basePlugin';

const registry = new Registry();

export {BasePlugin, registry};

export default {
    load: registry.load.bind(registry),
    add: registry.add.bind(registry),
    BasePlugin: BasePlugin,
};
