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
  assetCache = {};

  isLoaded(data: Plugin) {
    return defined(this.plugins[data.id]);
  }

  load(
    data: Plugin,
    callback: (instance: DefaultIssuePlugin | DefaultPlugin | SessionStackPlugin) => void
  ) {
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

    finishLoad();
    return;
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
