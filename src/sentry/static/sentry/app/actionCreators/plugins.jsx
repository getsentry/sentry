import {t} from '../locale';
import PluginActions from '../actions/pluginActions';
import IndicatorStore from '../stores/indicatorStore';
import {Client} from '../api';

const activeFetch = {};
// PluginsStore always exists, so api client should be independent of component lifecycle
const api = new Client();

function doUpdate({orgId, projectId, pluginId, update, ...params}) {
  PluginActions.update(pluginId, update);
  let request = api.requestPromise(
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
    .catch(err => {
      PluginActions.updateError(pluginId, update, err);
    });

  return request;
}

/**
 * Fetches list of available plugins for a project
 *
 * @param {object} params
 * @param {string} params.orgId Organization ID
 * @param {string} params.projectId Project ID
 * @param {object} options
 * @param {boolean} options.resetLoading Reset will set loading state = true
 * @return Promise
 */
export function fetchPlugins({orgId, projectId}, options) {
  let path = `/projects/${orgId}/${projectId}/plugins/`;

  // Make sure we throttle fetches
  if (activeFetch[path]) return activeFetch[path];

  PluginActions.fetchAll(options);
  let request = api.requestPromise(path, {
    method: 'GET',
  });

  activeFetch[path] = request;

  // This is intentionally not chained because we want the unhandled promise to be returned
  request
    .then((data, _, jqXHR) => {
      PluginActions.fetchAllSuccess(data, {
        pageLinks: jqXHR && jqXHR.getResponseHeader('Link'),
      });

      return data;
    })
    .catch(err => {
      PluginActions.fetchAllError(err);
      throw err;
    })
    .then(() => (activeFetch[path] = null));

  return request;
}

/**
 * Enables a plugin
 *
 * @param {object} params
 * @param {string} params.orgId Organization ID
 * @param {string} params.projectId Project ID
 * @param {string} params.pluginId Plugin ID
 * @return Promise
 */
export function enablePlugin(params) {
  IndicatorStore.add(t('Enabling...'));
  return doUpdate({...params, update: {enabled: true}, method: 'POST'})
    .then(() => IndicatorStore.addSuccess(t('Plugin was enabled')))
    .catch(() => IndicatorStore.addError(t('Unable to enable plugin')));
}

/**
 * Disables a plugin
 *
 * @param {object} params
 * @param {string} params.orgId Organization ID
 * @param {string} params.projectId Project ID
 * @param {string} params.pluginId Plugin ID
 */
export function disablePlugin(params) {
  IndicatorStore.add(t('Disabling...'));
  return doUpdate({...params, update: {enabled: false}, method: 'DELETE'})
    .then(() => IndicatorStore.addSuccess(t('Plugin was disabled')))
    .catch(() => IndicatorStore.addError(t('Unable to disable plugin')));
}
