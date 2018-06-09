import Reflux from 'reflux';

const SettingsBreadcrumbActions = Reflux.createActions(['mapTitle', 'trimMappings']);

export const normalizeRoutes = routes =>
  routes
    .filter(r => r.path)
    .map(r => r.path.replace(/^\//, ''))
    .join('');

export default SettingsBreadcrumbActions;
