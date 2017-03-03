/*eslint no-console:0*/
import {DefaultPlugin} from './defaultPlugin';
import {DefaultIssuePlugin} from './defaultIssuePlugin';
import {defined} from '../utils';

export default class Registry {
  constructor() {
    this.plugins = {};
    this.assetCache = {};
  }

  isLoaded(data) {
    return defined(this.plugins[data.id]);
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
        if (data.type === 'issue-tracking') {
          this.plugins[data.id] = DefaultIssuePlugin;
        } else {
          this.plugins[data.id] = DefaultPlugin;
        }
      }
      console.info('[plugins] Loaded ' + data.id + ' as {' + this.plugins[data.id].name + '}');
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
      console.error('[plugins] Failed to load asset ' + asset.url);
      if (remainingAssets === 0) {
        finishLoad();
      }
    };

    // TODO(dcramer): what do we do on failed asset loading?
    data.assets.forEach((asset) => {
      if (!defined(this.assetCache[asset.url])) {
        console.info('[plugins] Loading asset for ' + data.id + ': ' + asset.url);
        let s = document.createElement('script');
        s.src = asset.url;
        s.onload = onAssetLoaded.bind(this, asset);
        s.onerror = onAssetFailed.bind(this, asset);
        s.async = true;
        document.body.appendChild(s);
        this.assetCache[asset.url] = s;
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
    return new cls(data);
  }

  add(id, cls) {
    this.plugins[id] = cls;
  }
}
