/**
 * eCharts markLine
 *
 * See https://echarts.apache.org/en/option.html#series-line.markLine
 */

type FormatterCallback = (any) => string;

type StyleDraft = {
  show?: boolean;
  position?: string;
  distance?: number | number[];
  formatter?: string | FormatterCallback;
};

type LineStyle = StyleDraft & {
  emphasis?: StyleDraft;
};

export type MarkLine = {
  silent?: boolean;
  symbol?: string | string[];
  symbolSize?: number | number[];
  precision?: number;
  label?: object;
  lineStyle?: LineStyle;
  data?: any;
  // TODO(ts): create an echarts animation base type and include here
};
