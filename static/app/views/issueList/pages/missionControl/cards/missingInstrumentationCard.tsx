import {useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import taggingImage from 'sentry-images/spot/code-arguments-tags-mirrored.svg';
import tracingImage from 'sentry-images/spot/performance-empty-state.svg';
import profilingImage from 'sentry-images/spot/profiling-empty-state.svg';
import loggingImage from 'sentry-images/spot/waiting-for-event.svg';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {IndexedMembersByProject} from 'sentry/actionCreators/members';
import {fetchOrgMembers, indexMembersByProject} from 'sentry/actionCreators/members';
import {Text} from 'sentry/components/core/text';
import type {GroupListColumn} from 'sentry/components/issues/groupList';
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

// Instrument types that match the Python model
enum InstrumentType {
  LOGGING = 'logging',
  TAGGING = 'tagging',
  TRACING = 'tracing',
  PROFILING = 'profiling',
}

// Available Sentry products for instrumentation (kept for backwards compatibility)
export enum InstrumentationProduct {
  TRACING = 'tracing',
  PROFILING = 'profiling',
  UPTIME = 'uptime',
  PERFORMANCE = 'performance',
  ERRORS = 'errors',
  REPLAY = 'replay',
  CRONS = 'crons',
}

interface ObservabilityRequest {
  description: string; // Description of the observability to add and its purpose. 50-200 words.
  instrument_type: InstrumentType; // The type of instrumentation to add
  location: string; // Location in the code to add observability
}

// Matches RootCauseObservabilityRequests from Python model
interface MissingInstrumentationCardData {
  observability_requests: ObservabilityRequest[]; // A list of observability requests, max 5
  purpose: string; // What is the high-level aim of these observability requests? 20-100 words.
  sourceIssueId: string; // The ID of the source issue that triggered this card
}

type MissingInstrumentationCard = TypedMissionControlCard<
  'missing-instrumentation',
  MissingInstrumentationCardData
>;

// Helper function to get the background image based on instrument types
function getBackgroundImageForRequests(requests: ObservabilityRequest[]): string {
  const instrumentTypeImageMap = {
    [InstrumentType.TRACING]: tracingImage,
    [InstrumentType.PROFILING]: profilingImage,
    [InstrumentType.LOGGING]: loggingImage,
    [InstrumentType.TAGGING]: taggingImage,
  };

  // Priority order for when multiple types exist
  const priorityOrder = [
    InstrumentType.TRACING,
    InstrumentType.PROFILING,
    InstrumentType.LOGGING,
    InstrumentType.TAGGING,
  ];

  // Find the highest priority instrument type present in the requests
  for (const instrumentType of priorityOrder) {
    if (requests.some(request => request.instrument_type === instrumentType)) {
      return instrumentTypeImageMap[instrumentType];
    }
  }

  return tracingImage;
}

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

function MissingInstrumentationCardRenderer({
  card,
  onSetPrimaryAction,
}: CardRendererProps<MissingInstrumentationCardData>) {
  const {purpose, observability_requests, sourceIssueId} = card.data;
  const backgroundImage = getBackgroundImageForRequests(observability_requests);
  const organization = useOrganization();
  const memberList = useMemberList();

  // Create query to fetch the specific source issue by ID
  const queryParams = useMemo(
    () => ({
      group: [sourceIssueId],
      limit: '1',
      sort: 'freq',
    }),
    [sourceIssueId]
  );

  const {
    data: groups,
    isPending: isGroupPending,
    error: groupError,
    refetch: refetchGroup,
  } = useApiQuery<Group[]>(
    [
      `/organizations/${organization.slug}/issues/`,
      {
        query: queryParams,
      },
    ],
    {
      staleTime: 0,
      enabled: !!sourceIssueId,
    }
  );

  // Sync group store with the data as StreamGroup retrieves data from the store
  useSyncGroupStore(groups);

  useEffect(() => {
    // Set up the primary action to start instrumentation setup
    onSetPrimaryAction({
      label: 'Instrument for me',
      handler: async () => {
        // TODO: call AI agent
        await new Promise(resolve => setTimeout(resolve, 200));
        addSuccessMessage(
          "Seer is on it. We'll add this back to your stack when a PR is ready for review."
        );
      },
      loadingLabel: 'Starting...',
    });

    return () => onSetPrimaryAction(null);
  }, [onSetPrimaryAction]);

  return (
    <CardContainer backgroundImage={backgroundImage}>
      <Content>
        <RequestsSection>
          <HeaderSection>
            <Text size="xl" variant="muted">
              {t('Seer detected an observability gap')}
            </Text>
          </HeaderSection>

          <Text size="xl" bold>
            {purpose}
          </Text>

          <IssueSection>
            <Text size="lg" variant="muted" bold>
              {t('Helps debug issues like this')}
            </Text>

            {groupError ? (
              <LoadingError onRetry={refetchGroup} />
            ) : (
              <IssuesPanel>
                <PanelBody>
                  {isGroupPending ? (
                    <GroupPlaceholder>
                      <Placeholder height="50px" />
                    </GroupPlaceholder>
                  ) : groups && groups.length > 0 ? (
                    groups.map(({id, project}) => (
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
                    ))
                  ) : (
                    <Text size="md" variant="muted">
                      {t('Source issue not found')}
                    </Text>
                  )}
                </PanelBody>
              </IssuesPanel>
            )}
          </IssueSection>

          <Text size="lg" variant="muted" bold>
            {t('%s recommended addition(s)', observability_requests.length)}
          </Text>

          <RequestsList>
            {observability_requests.map((request, index) => (
              <RequestCard key={index}>
                <RequestDescription>
                  <Text size="md" density="comfortable">
                    {request.description}
                  </Text>
                </RequestDescription>
              </RequestCard>
            ))}
          </RequestsList>
        </RequestsSection>
      </Content>
    </CardContainer>
  );
}

const CardContainer = styled('div')<{backgroundImage: string}>`
  background: ${p => p.theme.backgroundElevated};
  background-image: url(${p => p.backgroundImage});
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: ${p => p.theme.borderRadius};
    background-color: ${p => p.theme.backgroundElevated};
    opacity: 0.3;
  }
`;

const Content = styled('div')`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: ${space(4)} ${space(4)};
  gap: ${space(4)};
  height: 100%;
  align-items: center;
  justify-content: center;
  max-width: 1000px;
  margin: 0 auto;
  position: relative;
  z-index: 1;
`;

const HeaderSection = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  align-self: flex-start;
`;

const RequestsSection = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(3)};
  padding: ${space(4)};
  margin: 0 ${space(4)};
  width: 80%;
  background-color: ${p => p.theme.backgroundElevated};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
  justify-content: center;
  box-shadow: ${p => p.theme.dropShadowHeavy};
`;

const RequestsList = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${space(1)};
  width: 100%;

  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
  }
`;

const RequestCard = styled('div')`
  display: flex;
  flex-direction: column;
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.innerBorder};
  box-shadow: ${p => p.theme.dropShadowMedium};
  overflow: hidden;
  min-height: 100px;
  background-color: ${p => p.theme.backgroundElevated};
`;

const RequestDescription = styled('div')`
  flex: 1;
  display: flex;
  align-items: flex-start;
  padding: ${space(2)};
`;

const IssueSection = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  flex: 1;
  min-height: 0;
  margin-bottom: ${space(2)};
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

export default MissingInstrumentationCardRenderer;
export type {
  MissingInstrumentationCard,
  MissingInstrumentationCardData,
  ObservabilityRequest,
};
export {InstrumentType};
