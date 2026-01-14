import {useEffect, useState} from 'react';

import type {Client, ResponseMeta} from 'sentry/api';
import MemberListStore from 'sentry/stores/memberListStore';
import type {PageFilters} from 'sentry/types/core';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import getDynamicText from 'sentry/utils/getDynamicText';
import {
  IssuesConfig,
  type IssuesSeriesResponse,
} from 'sentry/views/dashboards/datasetConfig/issues';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import type {WidgetQueryQueue} from 'sentry/views/dashboards/utils/widgetQueryQueue';

import type {
  GenericWidgetQueriesChildrenProps,
  OnDataFetchedProps,
} from './genericWidgetQueries';
import {useGenericWidgetQueries} from './genericWidgetQueries';

type Props = {
  api: Client;
  children: (props: GenericWidgetQueriesChildrenProps) => React.JSX.Element;
  organization: Organization;
  selection: PageFilters;
  widget: Widget;
  cursor?: string;
  dashboardFilters?: DashboardFilters;
  limit?: number;
  onDataFetchStart?: () => void;
  onDataFetched?: (results: OnDataFetchedProps) => void;
  queue?: WidgetQueryQueue;
};

function IssueWidgetQueries({
  queue,
  children,
  api,
  organization,
  selection,
  widget,
  cursor,
  limit,
  dashboardFilters,
  onDataFetched,
  onDataFetchStart,
}: Props) {
  const [memberListStoreLoaded, setMemberListStoreLoaded] = useState(false);

  useEffect(() => {
    setMemberListStoreLoaded(!MemberListStore.state.loading);
    const unlistener = MemberListStore.listen(() => {
      setMemberListStoreLoaded(!MemberListStore.state.loading);
    }, undefined);
    return () => unlistener();
  }, []);

  const config = IssuesConfig;

  const afterFetchTableData = (_rawResult: Group[], response?: ResponseMeta) => {
    return {totalIssuesCount: response?.getResponseHeader('X-Hits') ?? undefined};
  };

  const {loading, ...rest} = useGenericWidgetQueries<IssuesSeriesResponse, Group[]>({
    queue,
    config,
    api,
    organization,
    selection,
    widget,
    cursor,
    limit,
    dashboardFilters,
    onDataFetched,
    onDataFetchStart,
    afterFetchTableData,
    skipDashboardFilterParens: true, // Issue widgets do not support parens in search
  });

  return getDynamicText({
    value: children({
      loading: loading || !memberListStoreLoaded,
      ...rest,
    }),
    fixed: <div />,
  });
}

export default IssueWidgetQueries;
