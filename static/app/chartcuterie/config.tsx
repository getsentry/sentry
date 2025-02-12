/* global process */

/**
 * This module is used to define the look and feels for charts rendered via the
 * backend chart rendering service Chartcuterie.
 *
 * Be careful what you import into this file, as it will end up being bundled
 * into the configuration file loaded by the service.
 */

import {discoverCharts} from './discover';
import {metricAlertCharts} from './metricAlert';
import {performanceCharts} from './performance';
import type {
  ChartcuterieConfig,
  ChartType,
  RenderConfig,
  RenderDescriptor,
} from './types';

/**
 * All registered style descriptors
 */
const renderConfig: RenderConfig<ChartType> = new Map();

/**
 * Chartcuterie configuration object
 */
const config: ChartcuterieConfig = {
  version: process.env.COMMIT_SHA!,
  renderConfig,
};

/**
 * Register a style descriptor
 */
const register = (renderDescriptor: RenderDescriptor<ChartType>) =>
  renderConfig.set(renderDescriptor.key, renderDescriptor);

discoverCharts.forEach(register);
metricAlertCharts.forEach(register);
performanceCharts.forEach(register);

export default config;
