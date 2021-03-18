/**
 * XXX(epurkhiser): These are copied directly over from chartucterie to avoid
 * installing the package, which has some system-level dependencies we would
 * prefer not to install with sentry.
 */

import {EChartOption} from 'echarts';

export type RenderOption = Omit<EChartOption, 'animation' | 'tooltip' | 'toolbox'>;

/**
 * Describes configuration for a renderable chart style
 */
export type RenderDescriptor<D extends string = string> = {
  key: D;
  /**
   * Height of the produced image in pixels
   */
  height: number;
  /**
   * Width of the produced image in pixels
   */
  width: number;
  /**
   * Produce the echart option config for rendering the charts series. It is up
   * to the implementation to declare what data it should receive, as long as
   * it produces a valid ECharts Option config.
   */
  getOption: (data: any) => RenderOption;
};

/**
 * Maps style keys to style descriptor configuration
 */
export type RenderConfig<D extends string = string> = Map<D, RenderDescriptor<D>>;

/**
 * The data given to the service to render a chart
 */
export type RenderData = {
  /**
   * Globally unique render ID.
   */
  requestId: string;
  /**
   * The style config key
   */
  style: string;
  /**
   * Arbitrary series data. The RenderDescriptor.getOption should transform this
   * into a valid echarts series.
   */
  data: any;
};

/**
 * The configuration object type expected to be provided to the service
 */
export type ChartcuterieConfig = {
  renderConfig: RenderConfig;
  /**
   * A string version identifier for the configuration. This may be useful for
   * validating that a chart is being rendered using a specific known
   * configuration.
   */
  version: string;
};

/**
 * Configuration to specify how often to poll for configuration changes
 */
export type PollingConfig = {
  /**
   * The number of seconds between each polling attempt when the application boots
   * and has yet to load a configuration.
   */
  bootInterval: number;
  /**
   * The number of seconds between each polling attempt after the application
   * has already loaded a valid configuration file
   */
  idleInterval: number;
};
