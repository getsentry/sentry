/* eslint no-console:0 */
import {DefaultIssuePlugin} from 'sentry/plugins/defaultIssuePlugin';
import {DefaultPlugin} from 'sentry/plugins/defaultPlugin';
import type SessionStackPlugin from 'sentry/plugins/sessionstack';
import type {Plugin} from 'sentry/types/integrations';
import {defined} from 'sentry/utils';

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
    // TODO(dcramer): we should probably register all valid plugins
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
