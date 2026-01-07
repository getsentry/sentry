import {useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import type {IndexedMembersByProject} from 'sentry/actionCreators/members';
import {fetchOrgMembers, indexMembersByProject} from 'sentry/actionCreators/members';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import type {GroupListColumn} from 'sentry/components/issues/groupList';
import GroupListHeader from 'sentry/components/issues/groupListHeader';
import IssueStreamHeaderLabel from 'sentry/components/IssueStreamHeaderLabel';
import LoadingError from 'sentry/components/loadingError';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import Placeholder from 'sentry/components/placeholder';
import StreamGroup, {
  DEFAULT_STREAM_GROUP_STATS_PERIOD,
} from 'sentry/components/stream/group';
import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {t, tct} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useBreakpoints} from 'sentry/utils/useBreakpoints';
import {useIsMountedRef} from 'sentry/utils/useIsMountedRef';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useTransactionNameQuery} from 'sentry/views/insights/pages/platform/shared/useTransactionNameQuery';

const COLUMNS: GroupListColumn[] = [
  'graph',
  'event',
  'users',
  'assignee',
  'firstSeen',
  'lastSeen',
];

function useMemberList() {
  const api = useApi();
  const organization = useOrganization();
  const [memberList, setMemberList] = useState<IndexedMembersByProject | undefined>(
    undefined
  );

  const isMountedRef = useIsMountedRef();
  useEffect(() => {
    fetchOrgMembers(api, organization.slug).then(members => {
      if (isMountedRef.current) {
        setMemberList(indexMembersByProject(members));
      }
    });
  }, [api, organization, isMountedRef]);

  return memberList;
}

function useSyncGroupStore(data: Group[] | undefined) {
  useEffect(() => {
    GroupStore.loadInitialData([]);
    return () => {
      GroupStore.reset();
    };
  }, []);

  useEffect(() => {
    if (data) {
      GroupStore.add(data);
    }
  }, [data]);
}

export function IssuesWidget() {
  const pageFilters = usePageFilters().selection;
  const organization = useOrganization();
  const memberList = useMemberList();
  const breakpoints = useBreakpoints();

  const {query} = useTransactionNameQuery();

  const datetimeSelection = pageFilters.datetime;
  const queryParams = useMemo(
    () => ({
      limit: '5',
      ...normalizeDateTimeParams(datetimeSelection),
      project: pageFilters.projects,
      environment: pageFilters.environments,
      query: `is:unresolved event.type:error ${query}`,
      sort: 'freq',
    }),
    [datetimeSelection, pageFilters.environments, pageFilters.projects, query]
  );

  const {
    data: groups,
    isPending,
    error,
    refetch,
  } = useApiQuery<Group[]>(
    [
      `/organizations/${organization.slug}/issues/`,
      {
        query: queryParams,
      },
    ],
    {staleTime: 0}
  );

  // We need to sync group store with the data as StreamGroup retrieves data from the store
  useSyncGroupStore(groups);

  const issuesUrl = useMemo(() => {
    return {
      pathname: `/organizations/${organization.slug}/issues/`,
      query: queryParams,
    };
  }, [queryParams, organization.slug]);

  if (error) {
    return <LoadingError onRetry={refetch} />;
  }

  if (!isPending && groups.length === 0) {
    const selectedTimePeriod = datetimeSelection.start
      ? null
      : DEFAULT_RELATIVE_PERIODS[
          datetimeSelection.period as keyof typeof DEFAULT_RELATIVE_PERIODS
        ];
    const displayedPeriod = selectedTimePeriod
      ? selectedTimePeriod.toLowerCase()
      : t('given timeframe');

    return (
      <StyledPanel
        style={{display: 'flex', justifyContent: 'center', alignItems: 'center'}}
      >
        <PanelBody>
          <EmptyStateWarning>
            <p>
              {tct('No [issuesType] issues for the [timePeriod].', {
                issuesType: '',
                timePeriod: displayedPeriod,
              })}
            </p>
          </EmptyStateWarning>
        </PanelBody>
      </StyledPanel>
    );
  }

  return (
    <StyledPanel>
      <HeaderContainer>
        <SuperHeader disablePadding>
          <SuperHeaderLabel hideDivider>{t('Recommended Issues')}</SuperHeaderLabel>
          <LinkButton to={issuesUrl} size="xs">
            {t('View All')}
          </LinkButton>
        </SuperHeader>
        <GroupListHeader withChart={breakpoints.xl} withColumns={COLUMNS} />
      </HeaderContainer>
      <PanelBody>
        {isPending
          ? [...new Array(4)].map((_, i) => (
              <GroupPlaceholder key={i}>
                <Placeholder height="50px" />
              </GroupPlaceholder>
            ))
          : groups.map(({id, project}) => {
              return (
                <StreamGroup
                  key={id}
                  id={id}
                  canSelect={false}
                  withChart={breakpoints.xl}
                  withColumns={COLUMNS}
                  memberList={memberList?.[project.slug]}
                  useFilteredStats={false}
                  statsPeriod={DEFAULT_STREAM_GROUP_STATS_PERIOD}
                  source="laravel-insights"
                />
              );
            })}
      </PanelBody>
    </StyledPanel>
  );
}

const StyledPanel = styled(Panel)`
  min-width: 0;
  overflow-y: auto;
  margin-bottom: 0 !important;
  height: 100%;
  container-type: inline-size;
`;

const GroupPlaceholder = styled('div')`
  padding: ${space(1)};

  &:not(:last-child) {
    border-bottom: solid 1px ${p => p.theme.innerBorder};
  }
`;

const SuperHeaderLabel = styled(IssueStreamHeaderLabel)`
  color: ${p => p.theme.tokens.content.primary};
  font-size: 1rem;
  line-height: 1.2;
  padding-left: ${space(1)};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const SuperHeader = styled(PanelHeader)`
  background-color: ${p => p.theme.tokens.background.primary};
  padding: ${space(1)};
  text-transform: capitalize;
`;

const HeaderContainer = styled('div')`
  position: sticky;
  top: 0;
  z-index: ${p => p.theme.zIndex.header};
`;
