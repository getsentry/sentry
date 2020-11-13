/*eslint no-console:0*/
import {DefaultPlugin} from 'app/plugins/defaultPlugin';
import {DefaultIssuePlugin} from 'app/plugins/defaultIssuePlugin';
import SessionStackPlugin from 'app/plugins/sessionstack';
import {defined} from 'app/utils';
import {Plugin} from 'app/types';

type PluginComponent =
  | typeof DefaultIssuePlugin
  | typeof DefaultPlugin
  | typeof SessionStackPlugin;

export default class Registry {
  plugins: Record<string, PluginComponent> = {};
  assetCache: Record<string, HTMLScriptElement> = {};

  isLoaded(data: Plugin) {
    return defined(this.plugins[data.id]);
  }

  load(
    data: Plugin,
    callback: (instance: DefaultIssuePlugin | DefaultPlugin | SessionStackPlugin) => void
  ) {
    let remainingAssets = data.assets.length;
    // TODO(dcramer): we should probably register all valid plugins
    const finishLoad = () => {
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
    };

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

    const onAssetFailed = function (asset: {url: string}) {
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
        s.onload = onAssetLoaded.bind(this);
        s.onerror = onAssetFailed.bind(this, asset);
        s.async = true;
        document.body.appendChild(s);
        this.assetCache[asset.url] = s;
      } else {
        onAssetLoaded();
      }
    });
  }

  get(data: Plugin) {
    const cls = this.plugins[data.id];
    if (!defined(cls)) {
      throw new Error('Attempted to ``get`` an unloaded plugin: ' + data.id);
    }
    return new cls(data);
  }

  add(id: string, cls: PluginComponent) {
    this.plugins[id] = cls;
  }
}
