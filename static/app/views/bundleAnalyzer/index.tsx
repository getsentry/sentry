import ModulesTreemap from 'sentry/views/bundleAnalyzer/components/ModulesTreemap';
import {getViewerData} from 'sentry/views/bundleAnalyzer/utils/analyzer';

import {store} from './store';

const bundleStats = require('../../../../src/sentry/static/sentry/dist/stats.json');

const chartData = getViewerData(bundleStats);

store.defaultSize = `parsedSize`;
store.setModules(chartData);
store.setEntrypoints([null]);
function BundleAnalyzer() {
  return <ModulesTreemap />;
}
export default BundleAnalyzer;
