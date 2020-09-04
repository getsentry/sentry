import {Client, RequestOptions} from 'app/api';
import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import PluginActions from 'app/actions/pluginActions';
import {Plugin} from 'app/types';

const activeFetch = {};
// PluginsStore always exists, so api client should be independent of component lifecycle
const api = new Client();

type DoUpdateParams = {
  orgId: string;
  projectId: string;
  pluginId: string;
  update: Partial<Plugin>;
} & Partial<RequestOptions>;

function doUpdate({orgId, projectId, pluginId, update, ...params}: DoUpdateParams) {
  PluginActions.update(pluginId, update);
  const request = api.requestPromise(
    `/projects/${orgId}/${projectId}/plugins/${pluginId}/`,
    {
      ...params,
    }
  );

  // This is intentionally not chained because we want the unhandled promise to be returned
  request
    .then(() => {
      PluginActions.updateSuccess(pluginId, update);
    })
    .catch(resp => {
      const err =
        resp && resp.responseJSON && typeof resp.responseJSON.detail === 'string'
          ? new Error(resp.responseJSON.detail)
          : new Error('Unable to update plugin');
      PluginActions.updateError(pluginId, update, err);
    });

  return request;
}

/**
 * Fetches list of available plugins for a project
 *
 * @param orgId Organization ID
 * @param projectId Project ID
 * @param resetLoading Reset will set loading state = true
 */
export function fetchPlugins(
  {orgId, projectId}: {orgId: string; projectId: string},
  options?: {resetLoading?: boolean}
) {
  const path = `/projects/${orgId}/${projectId}/plugins/`;

  // Make sure we throttle fetches
  if (activeFetch[path]) {
    return activeFetch[path];
  }

  PluginActions.fetchAll(options);
  const request = api.requestPromise(path, {
    method: 'GET',
    includeAllArgs: true,
  });

  activeFetch[path] = request;

  // This is intentionally not chained because we want the unhandled promise to be returned
  request
    .then(([data, _, jqXHR]) => {
      PluginActions.fetchAllSuccess(data, {
        pageLinks: jqXHR && jqXHR.getResponseHeader('Link'),
      });

      return data;
    })
    .catch(err => {
      PluginActions.fetchAllError(err);
      throw new Error('Unable to fetch plugins');
    })
    .then(() => (activeFetch[path] = null));

  return request;
}

type EnableDisablePluginParams = {
  /**
   * Organization slug
   */
  orgId: string;
  projectId: string;
  pluginId: string;
};
/**
 * Enables a plugin
 *
 * @param {object} params
 * @param {string} params.orgId Organization ID
 * @param {string} params.projectId Project ID
 * @param {string} params.pluginId Plugin ID
 * @return Promise
 */
export function enablePlugin(params: EnableDisablePluginParams) {
  addLoadingMessage(t('Enabling...'));
  return doUpdate({...params, update: {enabled: true}, method: 'POST'})
    .then(() => addSuccessMessage(t('Plugin was enabled')))
    .catch(() => addErrorMessage(t('Unable to enable plugin')));
}

/**
 * Disables a plugin
 *
 * @param {object} params
 * @param {string} params.orgId Organization ID
 * @param {string} params.projectId Project ID
 * @param {string} params.pluginId Plugin ID
 */
export function disablePlugin(params: EnableDisablePluginParams) {
  addLoadingMessage(t('Disabling...'));
  return doUpdate({...params, update: {enabled: false}, method: 'DELETE'})
    .then(() => addSuccessMessage(t('Plugin was disabled')))
    .catch(() => addErrorMessage(t('Unable to disable plugin')));
}
