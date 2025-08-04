import {useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import type {IndexedMembersByProject} from 'sentry/actionCreators/members';
import {fetchOrgMembers, indexMembersByProject} from 'sentry/actionCreators/members';
import {Text} from 'sentry/components/core/text';
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
import type {
  CardRendererProps,
  TypedMissionControlCard,
} from 'sentry/types/missionControl';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useIsMountedRef} from 'sentry/utils/useIsMountedRef';
import useOrganization from 'sentry/utils/useOrganization';

const COLUMNS: GroupListColumn[] = [
  'graph',
  'event',
  'users',
  'assignee',
  'firstSeen',
  'lastSeen',
];

interface UltragroupCardData {
  description: string;
  issueIds: string[];
  title: string;
}

type UltragroupCard = TypedMissionControlCard<'ultragroup', UltragroupCardData>;

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

function UltragroupCardRenderer({
  card,
  onSetPrimaryAction,
}: CardRendererProps<UltragroupCardData>) {
  const {title, description, issueIds} = card.data;
  const organization = useOrganization();
  const memberList = useMemberList();

  // Create query to fetch specific issues by IDs using the group parameter
  const queryParams = useMemo(
    () => ({
      group: issueIds,
      limit: issueIds.length.toString(),
      sort: 'freq',
    }),
    [issueIds]
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
      enabled: issueIds.length > 0,
    }
  );

  // Sync group store with the data as StreamGroup retrieves data from the store
  useSyncGroupStore(groups);

  useEffect(() => {
    // TODO: trigger autofix on the top issue, with summarized context from all issues
    onSetPrimaryAction({
      label: 'Code up a fix for me',
      handler: async () => {
        // No-op for now
        await new Promise(resolve => setTimeout(resolve, 200));
      },
      loadingLabel: 'Starting...',
    });

    return () => onSetPrimaryAction(null);
  }, [onSetPrimaryAction]);

  if (error) {
    return (
      <CardContainer>
        <Content>
          <HeaderSection>
            <Text size="xl" bold>
              {t('Recurring Issue Pattern Detected')}
            </Text>
            <Text size="xl">{title}</Text>
            <Text size="md">{description}</Text>
          </HeaderSection>
          <LoadingError onRetry={refetch} />
        </Content>
      </CardContainer>
    );
  }

  if (!isPending && (!groups || groups.length === 0)) {
    return (
      <CardContainer>
        <Content>
          <HeaderSection>
            <Text size="xl" bold>
              {t('Recurring Issue Pattern Detected')}
            </Text>
            <Text size="xl">{title}</Text>
            <Text size="md">{description}</Text>
          </HeaderSection>
          <IssuesPanel>
            <PanelBody>
              <EmptyStateWarning>
                <p>{t('No issues found matching the specified criteria.')}</p>
              </EmptyStateWarning>
            </PanelBody>
          </IssuesPanel>
        </Content>
      </CardContainer>
    );
  }

  return (
    <CardContainer>
      <Content>
        <HeaderSection>
          <Text size="xl" bold>
            {t('Recurring Issue Pattern Detected')}
          </Text>
          <Text size="xl">{title}</Text>
          <Text size="md">{description}</Text>
        </HeaderSection>

        <IssuesSection>
          <IssuesPanel>
            <HeaderContainer>
              <GroupListHeader withChart withColumns={COLUMNS} />
            </HeaderContainer>
            <PanelBody>
              {isPending
                ? [...new Array(Math.min(issueIds.length, 4))].map((_, i) => (
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
        </IssuesSection>
      </Content>
    </CardContainer>
  );
}

const CardContainer = styled('div')`
  background: ${p => p.theme.backgroundElevated};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const Content = styled('div')`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: ${space(3)};
  gap: ${space(3)};
`;

const HeaderSection = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const IssuesSection = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
`;

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

export default UltragroupCardRenderer;
export type {UltragroupCard, UltragroupCardData};
