import PluginActions from '../actions/pluginActions';
import IndicatorStore from '../stores/indicatorStore';

function doUpdate(api, {orgId, projectId, pluginId, update, ...params}) {
  PluginActions.update(pluginId, update);
  return api
    .requestPromise(`/projects/${orgId}/${projectId}/plugins/${pluginId}/`, {
      ...params,
    })
    .then(() => {
      PluginActions.updateSuccess(pluginId, update);
    })
    .catch(err => {
      PluginActions.updateError(pluginId, update, err);
      throw err;
    });
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
  PluginActions.fetchAll(options);
  return api
    .requestPromise(`/projects/${orgId}/${projectId}/plugins/`, {
      method: 'GET',
    })
    .then((data, _, jqXHR) => {
      return PluginActions.fetchAllSuccess(data, {
        pageLinks: jqXHR && jqXHR.getResponseHeader('Link'),
      });
    })
    .catch(err => {
      return PluginActions.fetchAllError(err);
    });
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
