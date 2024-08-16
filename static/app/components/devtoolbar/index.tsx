import type {Configuration} from './types';

interface InitProps extends Configuration {
  rootNode?: HTMLElement;
}

const DevToolbar = {
  async init({rootNode, ...config}: InitProps) {
    const {default: mount} = await import('./mount');
    return mount(rootNode ?? document.body, config);
  },
};
export default DevToolbar;
