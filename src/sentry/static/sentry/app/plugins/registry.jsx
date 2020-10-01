/*eslint no-console:0*/
import {DefaultPlugin} from 'app/plugins/defaultPlugin';
import {DefaultIssuePlugin} from 'app/plugins/defaultIssuePlugin';
import {defined} from 'app/utils';

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
    const pluginList = [];
    dataList.map(data => {
      this.load(data, plugin => {
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
    const finishLoad = function () {
      if (!defined(this.plugins[data.id])) {
        if (data.type === 'issue-tracking') {
          this.plugins[data.id] = DefaultIssuePlugin;
        } else {
          this.plugins[data.id] = DefaultPlugin;
        }
      }
      console.info(
        '[plugins] Loaded ' + data.id + ' as {' + this.plugins[data.id].name + '}'
      );
      callback(this.get(data));
    }.bind(this);

    if (remainingAssets === 0) {
      finishLoad();
      return;
    }

    const onAssetLoaded = function () {
      remainingAssets--;
      if (remainingAssets === 0) {
        finishLoad();
      }
    };

    const onAssetFailed = function (asset) {
      remainingAssets--;
      console.error('[plugins] Failed to load asset ' + asset.url);
      if (remainingAssets === 0) {
        finishLoad();
      }
    };

    // TODO(dcramer): what do we do on failed asset loading?
    data.assets.forEach(asset => {
      if (!defined(this.assetCache[asset.url])) {
        console.info('[plugins] Loading asset for ' + data.id + ': ' + asset.url);
        const s = document.createElement('script');
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
    const cls = this.plugins[data.id];
    if (!defined(cls)) {
      throw new Error('Attempted to ``get`` an unloaded plugin: ' + data.id);
    }
    return new cls(data);
  }

  add(id, cls) {
    this.plugins[id] = cls;
  }
}
