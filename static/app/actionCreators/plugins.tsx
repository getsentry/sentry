import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import type {RequestOptions} from 'sentry/api';
import {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import PluginsStore from 'sentry/stores/pluginsStore';
import type {Plugin} from 'sentry/types/integrations';

// PluginsStore always exists, so api client should be independent of component lifecycle
const api = new Client();

type Slugs = {
  /**
   * Organization slug
   */
  orgId: string;

  /**
   * Plugin slug
   */
  pluginId: string;

  /**
   * Project slug
   */
  projectId: string;
};

type DoUpdateParams = Slugs & {
  update: Partial<Plugin>;
} & Partial<RequestOptions>;

function doUpdate({orgId, projectId, pluginId, update, ...params}: DoUpdateParams) {
  PluginsStore.onUpdate(pluginId, update);
  const request = api.requestPromise(
    `/projects/${orgId}/${projectId}/plugins/${pluginId}/`,
    {
      ...params,
    }
  );

  // This is intentionally not chained because we want the unhandled promise to be returned
  request
    .then(() => {
      PluginsStore.onUpdateSuccess(pluginId);
    })
    .catch(resp => {
      const err =
        typeof resp?.responseJSON?.detail === 'string'
          ? new Error(resp.responseJSON.detail)
          : new Error('Unable to update plugin');
      PluginsStore.onUpdateError(pluginId, err);
    });

  return request;
}

type EnableDisablePluginParams = Slugs;

/**
 * Disables a plugin
 */
export function disablePlugin(params: EnableDisablePluginParams) {
  addLoadingMessage(t('Disabling...'));
  return doUpdate({...params, update: {enabled: false}, method: 'DELETE'})
    .then(() => addSuccessMessage(t('Plugin was disabled')))
    .catch(() => addErrorMessage(t('Unable to disable plugin')));
}
