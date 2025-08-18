import {useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import type {IndexedMembersByProject} from 'sentry/actionCreators/members';
import {fetchOrgMembers, indexMembersByProject} from 'sentry/actionCreators/members';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import type {GroupListColumn} from 'sentry/components/issues/groupList';
import GroupListHeader from 'sentry/components/issues/groupListHeader';
import LoadingError from 'sentry/components/loadingError';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import Placeholder from 'sentry/components/placeholder';
import StreamGroup, {
  DEFAULT_STREAM_GROUP_STATS_PERIOD,
} from 'sentry/components/stream/group';
import {t} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useIsMountedRef} from 'sentry/utils/useIsMountedRef';
import useOrganization from 'sentry/utils/useOrganization';
import {useProjectSelection} from 'sentry/views/issueList/pages/missionControl/projectContext';

const COLUMNS: GroupListColumn[] = [
  'graph',
  'event',
  'users',
  'assignee',
  'firstSeen',
  'lastSeen',
];

const ITEMS_LIMIT = 5;

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

function NewIssuesSection() {
  const organization = useOrganization();
  const memberList = useMemberList();
  const {selectedProjects} = useProjectSelection();

  // Query for new, unresolved issues sorted by date
  const queryParams = useMemo(
    () => ({
      query: 'is:unresolved is:new',
      limit: ITEMS_LIMIT.toString(),
      sort: 'date',
      project: selectedProjects,
    }),
    [selectedProjects]
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
    {
      staleTime: 0,
    }
  );

  // Sync group store with the data as StreamGroup retrieves data from the store
  useSyncGroupStore(groups);

  if (error) {
    return <LoadingError onRetry={refetch} />;
  }

  if (!isPending && (!groups || groups.length === 0)) {
    return (
      <IssuesPanel>
        <PanelBody>
          <EmptyStateWarning>
            <p>{t('No new issues found.')}</p>
          </EmptyStateWarning>
        </PanelBody>
      </IssuesPanel>
    );
  }

  return (
    <IssuesPanel>
      <HeaderContainer>
        <GroupListHeader withChart withColumns={COLUMNS} />
      </HeaderContainer>
      <PanelBody>
        {isPending
          ? [...new Array(5)].map((_, i) => (
              <GroupPlaceholder key={i}>
                <Placeholder height="50px" />
              </GroupPlaceholder>
            ))
          : groups?.map(({id, project}) => {
              return (
                <StreamGroup
                  key={id}
                  id={id}
                  canSelect={false}
                  withChart
                  withColumns={COLUMNS}
                  memberList={memberList?.[project.slug]}
                  useFilteredStats={false}
                  statsPeriod={DEFAULT_STREAM_GROUP_STATS_PERIOD}
                  source="mission-control"
                />
              );
            })}
      </PanelBody>
    </IssuesPanel>
  );
}

const IssuesPanel = styled(Panel)`
  min-width: 0;
  overflow-y: auto;
  margin-bottom: 0 !important;
  flex: 1;
  container-type: inline-size;
`;

const GroupPlaceholder = styled('div')`
  padding: ${space(1)};

  &:not(:last-child) {
    border-bottom: solid 1px ${p => p.theme.innerBorder};
  }
`;

const HeaderContainer = styled('div')`
  position: sticky;
  top: 0;
  z-index: ${p => p.theme.zIndex.header};
  background: ${p => p.theme.background};
`;

export default NewIssuesSection;
