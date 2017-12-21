import PluginActions from '../actions/pluginActions';
import IndicatorStore from '../stores/indicatorStore';

let activeFetch = {};

function doUpdate(api, {orgId, projectId, pluginId, update, ...params}) {
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
 * @param {Client} api
 * @param {object} params
 * @param {string} params.orgId Organization ID
 * @param {string} params.projectId Project ID
 * @param {string} params.pluginId Plugin ID
 * @param {object} options
 * @param {boolean} options.noReset Reset will set loading state = true
 * @return Promise
 */
export function fetchPlugins(api, {orgId, projectId}, options) {
  let path = `/projects/${orgId}/${projectId}/plugins/`;
  if (activeFetch[path]) return activeFetch[path];

  PluginActions.fetchAll(options);
  let request = api.requestPromise(`/projects/${orgId}/${projectId}/plugins/`, {
    method: 'GET',
  });

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
 * @param {Client} api
 * @param {object} params
 * @param {string} params.orgId Organization ID
 * @param {string} params.projectId Project ID
 * @param {string} params.pluginId Plugin ID
 * @return Promise
 */
export function enablePlugin(api, params) {
  IndicatorStore.add('Enabling...');
  return doUpdate(api, {...params, update: {enabled: true}, method: 'POST'})
    .then(() => IndicatorStore.addSuccess('Plugin was enabled'))
    .catch(() => IndicatorStore.addError('Unable to enable plugin'));
}

/**
 * Disables a plugin
 *
 * @param {Client} api
 * @param {object} params
 * @param {string} params.orgId Organization ID
 * @param {string} params.projectId Project ID
 * @param {string} params.pluginId Plugin ID
 */
export function disablePlugin(api, params) {
  IndicatorStore.add('Disabling...');
  return doUpdate(api, {...params, update: {enabled: false}, method: 'DELETE'})
    .then(() => IndicatorStore.addSuccess('Plugin was disabled'))
    .catch(() => IndicatorStore.addError('Unable to disable plugin'));
}
