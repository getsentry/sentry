import {BundleContextProvider} from 'sentry/views/bundleAnalyzer/bundleContextProvider';
import ModulesTreemap from 'sentry/views/bundleAnalyzer/components/ModulesTreemap';
import {getViewerData} from 'sentry/views/bundleAnalyzer/utils/analyzer';

import {store} from './store';

export const bundleStats = require('../../../../src/sentry/static/sentry/dist/stats.json');

const chartData = getViewerData(bundleStats);

store.defaultSize = `parsedSize`;
store.setModules(chartData);
store.setEntrypoints([null]);
function BundleAnalyzer() {
  return (
    <BundleContextProvider>
      <ModulesTreemap />
    </BundleContextProvider>
  );
}
export default BundleAnalyzer;
