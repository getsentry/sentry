// Knip's Rsbuild plugin does not inspect tools.rspack yet. Let its Rspack plugin
// read our entries, loaders, SWC plugins, and aliases from the same configs.
export {configs as default} from '../rsbuild.config.ts';
