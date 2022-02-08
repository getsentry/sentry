import * as React from 'react';

import {Client} from 'sentry/api';
import {MetricsApiResponse, OrganizationSummary, PageFilters} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';

import {Widget} from '../types';

type Props = {
  api: Client;
  children: (
    props: Pick<State, 'loading' | 'timeseriesResults' | 'tableResults' | 'errorMessage'>
  ) => React.ReactNode;
  organization: OrganizationSummary;
  selection: PageFilters;
  widget: Widget;
  limit?: number;
};

type State = {
  loading: boolean;
  errorMessage?: string;
  queryFetchID?: symbol;
  rawResults?: MetricsApiResponse[];
  tableResults?: TableDataWithTitle[];
  timeseriesResults?: Series[];
};

class MetricsWidgetQueries extends React.Component<Props, State> {
  render() {
    return null;
  }
}

export default MetricsWidgetQueries;
