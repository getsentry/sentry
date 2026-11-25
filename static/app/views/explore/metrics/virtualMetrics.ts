import {DurationUnit, FractionUnit, type DataUnit} from 'sentry/utils/discover/fields';
import {ORDER, type WebVitals} from 'sentry/views/insights/browser/webVitals/types';

import type {TraceMetric} from './metricQuery';
import type {TraceMetricTypeValue} from './types';

/**
 * A stored metric, with the unit typed so prebuilt configs can use it.
 */
interface StoredTraceMetric {
  name: string;
  type: TraceMetricTypeValue;
  unit: DataUnit;
}

/**
 * A numeric attribute on a stored metric, offered in the metric selector as if
 * it were a metric of its own. Its aggregates read the attribute instead of
 * the metric's value: `avg(<attribute>,<source name>,<source type>,<source unit>)`.
 */
export interface VirtualTraceMetric {
  /**
   * The aggregate argument that selects the attribute, e.g.
   * `tags[score.ratio.lcp,number]`.
   */
  attribute: string;
  name: string;
  /**
   * The stored metric the attribute lives on.
   */
  source: StoredTraceMetric;
  type: TraceMetricTypeValue;
  unit: string;
}

/**
 * The stored metric for a web vital, e.g. `browser.web_vital.lcp`.
 */
export function webVitalMetric(vital: WebVitals): StoredTraceMetric {
  return {
    name: `browser.web_vital.${vital}`,
    type: 'distribution',
    unit: vital === 'cls' ? null : DurationUnit.MILLISECOND,
  };
}

/**
 * Each web vital metric carries its score ratio (0 to 1) as a numeric
 * attribute. The selector offers it as `browser.web_vital.<vital>.score`.
 */
export function webVitalScoreMetric(vital: WebVitals): VirtualTraceMetric {
  return {
    name: `browser.web_vital.${vital}.score`,
    type: 'distribution',
    unit: FractionUnit.RATIO,
    source: webVitalMetric(vital),
    attribute: `tags[score.ratio.${vital},number]`,
  };
}

let webVitalScoreMetrics: VirtualTraceMetric[] | undefined;

/**
 * The score metric of every web vital. Built on first use rather than at
 * load: `sentry/utils/discover/fields` imports this module to label
 * aggregates, so the unit enums it defines are not initialized yet while
 * this module loads.
 */
export function getWebVitalScoreMetrics(): VirtualTraceMetric[] {
  webVitalScoreMetrics ??= ORDER.map(webVitalScoreMetric);
  return webVitalScoreMetrics;
}

/**
 * Every virtual metric the metric selectors know about.
 */
function getVirtualTraceMetrics(): VirtualTraceMetric[] {
  return getWebVitalScoreMetrics();
}

/**
 * The virtual metric a selected metric stands for, if any. The unit is not
 * compared so a stored metric of the same name resolves to the virtual one.
 */
export function findVirtualTraceMetric(
  metric: TraceMetric
): VirtualTraceMetric | undefined {
  return getVirtualTraceMetrics().find(
    virtual => virtual.name === metric.name && virtual.type === metric.type
  );
}

/**
 * The virtual metric an aggregate stands for, given the attribute it reads and
 * the stored metric it reads it from.
 */
export function findVirtualTraceMetricByAttribute(
  attribute: string,
  source: TraceMetric
): VirtualTraceMetric | undefined {
  return getVirtualTraceMetrics().find(
    virtual =>
      virtual.attribute === attribute &&
      virtual.source.name === source.name &&
      virtual.source.type === source.type
  );
}
