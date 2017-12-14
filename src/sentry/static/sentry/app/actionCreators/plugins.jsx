import PluginActions from '../actions/pluginActions';
import IndicatorStore from '../stores/indicatorStore';

function doUpdate(api, {orgId, projectId, pluginId, update: updateObj, ...params}) {
  PluginActions.update(pluginId, updateObj);
  return api
    .requestPromise(`/projects/${orgId}/${projectId}/plugins/${pluginId}/`, {
      ...params,
    })
    .then(() => {
      PluginActions.updateSuccess(pluginId, updateObj);
    })
    .catch(err => {
      PluginActions.updateError(pluginId, updateObj, err);
      throw err;
    });
}

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

export function enablePlugin(api, params) {
  IndicatorStore.add('Enabling...');
  doUpdate(api, {...params, update: {enabled: true}, method: 'POST'})
    .then(() => IndicatorStore.addSuccess('Plugin was enabled'))
    .catch(() => IndicatorStore.addError('Unable to enable plugin'));
}

export function disablePlugin(api, params) {
  IndicatorStore.add('Disabling...');
  doUpdate(api, {...params, update: {enabled: false}, method: 'DELETE'})
    .then(() => IndicatorStore.addSuccess('Plugin was disabled'))
    .catch(() => IndicatorStore.addError('Unable to disable plugin'));
}
