import type {ChartType} from 'sentry/views/insights/common/components/chart';

export interface NoneOfTheseItem {
  key: 'none-of-these';
  label: string;
}

export interface AskSeerSearchItem<S extends string> {
  key: S extends 'none-of-these' ? never : S;
}

export type AskSeerSearchItems<T> = (AskSeerSearchItem<string> & T) | NoneOfTheseItem;

export interface QueryTokensProps {
  groupBys?: string[];
  query?: string;
  sort?: string;
  statsPeriod?: string;
  visualizations?: Array<{chartType: ChartType; yAxes: string[]}>;
}
