import {EChartOption} from 'echarts';

/**
 * Defines the keys which may be passed into the chartcuterie chart rendering
 * service.
 *
 * When adding or removing from this list, please also update the
 * sentry/charts/types.py file
 */
export enum ChartType {
  SLACK_DISCOVER_TOTAL_PERIOD = 'slack:discover.totalPeriod',
  SLACK_DISCOVER_TOTAL_DAILY = 'slack:discover.totalDaily',
  SLACK_DISCOVER_TOP5_PERIOD = 'slack:discover.top5Period',
  SLACK_DISCOVER_TOP5_PERIOD_LINE = 'slack:discover.top5PeriodLine',
  SLACK_DISCOVER_TOP5_DAILY = 'slack:discover.top5Daily',
  SLACK_DISCOVER_PREVIOUS_PERIOD = 'slack:discover.previousPeriod',
  SLACK_DISCOVER_WORLDMAP = 'slack:discover.worldmap',
}

/**
 * XXX(epurkhiser): These are copied directly over from chartucterie to avoid
 * installing the package, which has some system-level dependencies we would
 * prefer not to install with sentry.
 */

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
 * Performs any additional initialization steps on Chartcuterie's global
 * echarts object on service start up. For example, registerMaps can
 * be called here to register any available maps to ECharts.
 */
export type InitFn = (echarts: any) => void;

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
  /**
   * The optional initialization function to run when the service starts
   * or restarts due to configuration updates.
   */
  init?: InitFn;
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
