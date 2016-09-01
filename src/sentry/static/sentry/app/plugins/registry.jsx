import {DefaultPlugin} from './defaultPlugin';
import {defined} from '../utils';

export default class Registry {
  constructor() {
    this.plugins = {};
    this.assetCache = {};
  }

  loadAll(dataList, callback) {
    let remaining = dataList.length;
    let pluginList = [];
    dataList.map((data) => {
      this.load(data, (plugin) => {
        remaining--;
        pluginList.push(plugin);
        if (remaining === 0) {
          callback(pluginList);
        }
      });
    });
  }

  load(data, callback) {
    // TODO(dcramer): we should probably register all valid plugins
    let remainingAssets = data.assets.length;
    let finishLoad = function() {
      if (!defined(this.plugins[data.id])) {
        this.plugins[data.id] = DefaultPlugin;
      }
      callback(this.get(data));
    }.bind(this);

    if (remainingAssets === 0) {
      finishLoad();
      return;
    }

    let onAssetLoaded = function(asset) {
      remainingAssets--;
      if (remainingAssets === 0) {
        finishLoad();
      }
    };

    let onAssetFailed = function(asset) {
      remainingAssets--;
      if (remainingAssets === 0) {
        finishLoad();
      }
    };

    // TODO(dcramer): what do we do on failed asset loading?
    data.assets.forEach((asset) => {
      console.log('[plugins] Loading asset for ' + data.id + ': ' + asset.url);
      if (!defined(this.assetCache[asset.url])) {
        let s = document.createElement('script');
        s.src = asset.url;
        s.onload = onAssetLoaded.bind(this, asset);
        s.onerror = onAssetFailed.bind(this, asset);
        document.body.appendChild(s);
        this.assetCache[asset.url] = 1;
      } else {
        onAssetLoaded(asset);
      }
    });
  }

  get(data) {
    let cls = this.plugins[data.id];
    if (!defined(cls)) {
      throw new Error('Attempted to ``get`` an unloaded plugin: ' + data.id);
    }
    console.log('[plugins] Loading ' + data.id + ' as {' + cls.name + '}');
    return new cls(data);
  }

  add(id, cls) {
    this.plugins[id] = cls;
  }
}
