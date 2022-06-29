import {useCallback, useEffect, useState} from 'react';

import {Client, ResponseMeta} from 'sentry/api';
import MemberListStore from 'sentry/stores/memberListStore';
import {Group, Organization, PageFilters} from 'sentry/types';
import getDynamicText from 'sentry/utils/getDynamicText';

import {IssuesConfig} from '../datasetConfig/issues';
import {Widget} from '../types';

import GenericWidgetQueries, {
  GenericWidgetQueriesChildrenProps,
  OnDataFetchedProps,
} from './genericWidgetQueries';

type Props = {
  api: Client;
  children: (props: GenericWidgetQueriesChildrenProps) => JSX.Element;
  organization: Organization;
  selection: PageFilters;
  widget: Widget;
  cursor?: string;
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
  onDataFetched,
}: Props) {
  const [memberListStoreLoaded, setMemberListStoreLoaded] = useState(false);

  useEffect(() => {
    setMemberListStoreLoaded(MemberListStore.isLoaded());
    const unlistener = MemberListStore.listen(() => {
      setMemberListStoreLoaded(MemberListStore.isLoaded());
    }, undefined);
    return () => unlistener();
  }, []);

  const config = IssuesConfig;

  const afterFetchTableData = useCallback(
    (_rawResult: Group[], response?: ResponseMeta) => {
      return {totalIssuesCount: response?.getResponseHeader('X-Hits') ?? undefined};
    },
    []
  );

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
        onDataFetched={onDataFetched}
        afterFetchTableData={afterFetchTableData}
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
