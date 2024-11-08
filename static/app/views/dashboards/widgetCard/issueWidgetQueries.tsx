import {useEffect, useState} from 'react';

import type {Client, ResponseMeta} from 'sentry/api';
import MemberListStore from 'sentry/stores/memberListStore';
import type {PageFilters} from 'sentry/types/core';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import getDynamicText from 'sentry/utils/getDynamicText';

import {IssuesConfig} from '../datasetConfig/issues';
import type {DashboardFilters, Widget} from '../types';

import type {
  GenericWidgetQueriesChildrenProps,
  OnDataFetchedProps,
} from './genericWidgetQueries';
import GenericWidgetQueries from './genericWidgetQueries';

type Props = {
  api: Client;
  children: (props: GenericWidgetQueriesChildrenProps) => JSX.Element;
  organization: Organization;
  selection: PageFilters;
  widget: Widget;
  cursor?: string;
  dashboardFilters?: DashboardFilters;
  limit?: number;
  onDataFetched?: (results: OnDataFetchedProps) => void;
};

function IssueWidgetQueries({
  children,
  api,
  organization,
  selection,
  widget,
  cursor,
  limit,
  dashboardFilters,
  onDataFetched,
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

  return getDynamicText({
    value: (
      <GenericWidgetQueries<never, Group[]>
        config={config}
        api={api}
        organization={organization}
        selection={selection}
        widget={widget}
        cursor={cursor}
        limit={limit}
        dashboardFilters={dashboardFilters}
        onDataFetched={onDataFetched}
        afterFetchTableData={afterFetchTableData}
        skipDashboardFilterParens // Issue widgets do not support parens in search
      >
        {({loading, ...rest}) =>
          children({
            loading: loading || !memberListStoreLoaded,
            ...rest,
          })
        }
      </GenericWidgetQueries>
    ),
    fixed: <div />,
  });
}

export default IssueWidgetQueries;
