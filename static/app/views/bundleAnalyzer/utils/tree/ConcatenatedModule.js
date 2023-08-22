import invokeMap from 'lodash/invokeMap';

import ContentFolder from './ContentFolder';
import ContentModule from './ContentModule';
import Module from './Module';
import {getModulePathParts} from './utils';

export default class ConcatenatedModule extends Module {
  constructor(name, data, parent) {
    super(name, data, parent);
    this.name += ' (concatenated)';
    this.children = Object.create(null);
    this.fillContentModules();
  }

  get parsedSize() {
    return this.getParsedSize() ?? this.getEstimatedSize('parsedSize');
  }

  get gzipSize() {
    return this.getGzipSize() ?? this.getEstimatedSize('gzipSize');
  }

  getEstimatedSize(sizeType) {
    const parentModuleSize = this.parent[sizeType];

    if (parentModuleSize !== undefined) {
      return Math.floor((this.size / this.parent.size) * parentModuleSize);
    }
    return undefined;
  }

  fillContentModules() {
    this.data.modules.forEach(moduleData => this.addContentModule(moduleData));
  }

  addContentModule(moduleData) {
    const pathParts = getModulePathParts(moduleData);

    if (!pathParts) {
      return;
    }

    const [folders, fileName] = [pathParts.slice(0, -1), pathParts[pathParts.length - 1]];
    let currentFolder = this;

    folders.forEach(folderName => {
      let childFolder = currentFolder.getChild(folderName);

      if (!childFolder) {
        childFolder = currentFolder.addChildFolder(new ContentFolder(folderName, this));
      }

      currentFolder = childFolder;
    });

    const ModuleConstructor = moduleData.modules ? ConcatenatedModule : ContentModule;
    const module = new ModuleConstructor(fileName, moduleData, this);
    currentFolder.addChildModule(module);
  }

  getChild(name) {
    return this.children[name];
  }

  addChildModule(module) {
    module.parent = this;
    this.children[module.name] = module;
  }

  addChildFolder(folder) {
    folder.parent = this;
    this.children[folder.name] = folder;
    return folder;
  }

  mergeNestedFolders() {
    invokeMap(this.children, 'mergeNestedFolders');
  }

  toChartData() {
    return {
      ...super.toChartData(),
      concatenated: true,
      groups: invokeMap(this.children, 'toChartData'),
    };
  }
}
