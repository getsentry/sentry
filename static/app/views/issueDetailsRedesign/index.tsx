import {useMemo, useRef} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tabs, TabList, TabPanels} from '@sentry/scraps/tabs';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {withMeta} from 'sentry/components/events/meta/metaProxy';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import {getTitle} from 'sentry/utils/events';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {decodeScalar} from 'sentry/utils/queryString';
import {useReplayCountForIssues} from 'sentry/utils/replayCount/useReplayCountForIssues';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useProjectFromSlug} from 'sentry/utils/useProjectFromSlug';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';
import {makeReplaysPathname} from 'sentry/views/explore/replays/pathnames';
import {IssueDetailsContextProvider} from 'sentry/views/issueDetails/context';
import {EventDetailsHeader} from 'sentry/views/issueDetails/eventDetailsHeader';
import {IssueDetailsEventNavigation} from 'sentry/views/issueDetails/eventNavigation/issueDetailsEventNavigation';
import {GroupDataContextProvider} from 'sentry/views/issueDetails/groupDataContext';
import {EventDetailsContent} from 'sentry/views/issueDetails/groupEventDetails/groupEventDetailsContent';
import {GroupEventDetailsLoading} from 'sentry/views/issueDetails/groupEventDetails/groupEventDetailsLoading';
import {useIssueDetailsEventView} from 'sentry/views/issueDetails/hooks/useIssueDetailsDiscoverQuery';
import {useGroup} from 'sentry/views/issueDetails/useGroup';
import {useGroupEvent} from 'sentry/views/issueDetails/useGroupEvent';
import {AskSeerSelectionMenu} from 'sentry/views/issueDetailsRedesign/askSeerSelectionMenu';
import {InvestigationContent} from 'sentry/views/issueDetailsRedesign/investigationContent';
import {RedesignHeader} from 'sentry/views/issueDetailsRedesign/redesignHeader';
import {ReorderSectionsControl} from 'sentry/views/issueDetailsRedesign/reorderSectionsControl';
import {TelemetryLayoutStyles} from 'sentry/views/issueDetailsRedesign/telemetrySections';
import {useSeerExplorerContext} from 'sentry/views/seerExplorer/useSeerExplorerContext';

type RedesignTab = 'investigation' | 'telemetry';

function isRedesignTab(value: string | undefined): value is RedesignTab {
  return value === 'investigation' || value === 'telemetry';
}

/**
 * A parallel, experimental issue details page that splits the issue into two
 * tabs — Investigation (a merged Seer + activity timeline) and Telemetry (the
 * event's stack trace, breadcrumbs, tags and other data). It reuses the classic
 * page's data hooks and header/graph/tags/telemetry building blocks, but owns
 * its own layout. Reachable only from the inbox external-link affordance; the
 * classic page is untouched.
 */
export default function IssueDetailsRedesign() {
  const theme = useTheme();
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams<{groupId: string; eventId?: string}>();
  const pageRef = useRef<HTMLDivElement>(null);

  const {
    data: group,
    isPending: isGroupPending,
    isError: isGroupError,
    refetch: refetchGroup,
  } = useGroup({groupId: params.groupId});

  const {data: event, isPending: isEventPending} = useGroupEvent({
    groupId: params.groupId,
    eventId: params.eventId,
  });

  const eventWithMeta = useMemo(() => withMeta(event), [event]);
  const project = useProjectFromSlug({organization, projectSlug: group?.project?.slug});

  const tabParam = decodeScalar(location.query.tab);
  const activeTab: RedesignTab = isRedesignTab(tabParam)
    ? tabParam
    : params.eventId
      ? 'telemetry'
      : 'investigation';

  const handleTabChange = (tab: RedesignTab) => {
    navigate(
      {...location, query: {...location.query, tab}},
      {replace: true, preventScrollReset: true}
    );
  };

  if (isGroupPending || !project) {
    return <LoadingIndicator />;
  }

  if (isGroupError || !group) {
    return <LoadingError onRetry={refetchGroup} />;
  }

  return (
    <SentryDocumentTitle
      noSuffix
      title={`${getTitle(group).title} — ${organization.slug}`}
    >
      <PageFiltersContainer
        skipLoadLastUsed
        forceProject={group.project}
        shouldForceProject
      >
        <GroupDataContextProvider group={group} project={project}>
          <IssueDetailsContextProvider>
            <Page
              ref={pageRef}
              style={{'--issue-details-inset': theme.space.xl} as React.CSSProperties}
            >
              <RedesignAskSeer containerRef={pageRef} />
              <RedesignHeader
                group={group}
                event={eventWithMeta ?? null}
                project={project}
              />
              <EventDetailsHeader group={group} event={eventWithMeta} project={project} />
              <TabsBody>
                <Tabs<RedesignTab> value={activeTab} onChange={handleTabChange}>
                  <TabList>
                    <TabList.Item key="investigation">{t('Investigation')}</TabList.Item>
                    <TabList.Item key="telemetry">{t('Telemetry')}</TabList.Item>
                  </TabList>
                  <TabPanels>
                    <TabPanels.Item key="investigation">
                      <PanelContent>
                        <ErrorBoundary mini>
                          <InvestigationContent />
                        </ErrorBoundary>
                      </PanelContent>
                    </TabPanels.Item>
                    <TabPanels.Item key="telemetry">
                      <PanelContent>
                        <EventNavRow>
                          <NavGroup>
                            <ErrorBoundary mini>
                              <IssueDetailsEventNavigation
                                event={eventWithMeta}
                                group={group}
                                baseEventsPath={`/organizations/${organization.slug}/issues/redesign/${group.id}/events/`}
                              />
                            </ErrorBoundary>
                            <ErrorBoundary mini>
                              <ReorderSectionsControl />
                            </ErrorBoundary>
                            <ErrorBoundary mini>
                              <TelemetryOverflowMenu group={group} />
                            </ErrorBoundary>
                          </NavGroup>
                        </EventNavRow>
                        {isEventPending || !eventWithMeta ? (
                          <GroupEventDetailsLoading />
                        ) : (
                          <TelemetrySections data-telemetry-container="">
                            <TelemetryLayoutStyles />
                            <EventDetailsContent
                              group={group}
                              event={eventWithMeta}
                              project={project}
                            />
                          </TelemetrySections>
                        )}
                      </PanelContent>
                    </TabPanels.Item>
                  </TabPanels>
                </Tabs>
              </TabsBody>
            </Page>
          </IssueDetailsContextProvider>
        </GroupDataContextProvider>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

function RedesignAskSeer({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
}) {
  const {openSeerExplorer} = useSeerExplorerContext();
  return (
    <AskSeerSelectionMenu
      containerRef={containerRef}
      onAskSeer={text => openSeerExplorer({initialQuery: text})}
    />
  );
}

function TelemetryOverflowMenu({group}: {group: Group}) {
  const organization = useOrganization();
  const location = useLocation();
  const eventView = useIssueDetailsEventView({group});
  const issueTypeConfig = getConfigForIssueType(group, group.project);

  const discoverUrl = eventView.getResultsViewUrlTarget(
    organization,
    false,
    hasDatasetSelector(organization) ? SavedQueryDatasets.ERRORS : undefined
  );

  const {getReplayCountForIssue} = useReplayCountForIssues({statsPeriod: '90d'});
  const replaysCount = getReplayCountForIssue(group.id, group.issueCategory) ?? 0;
  const showReplays = issueTypeConfig.pages.replays.enabled && replaysCount > 0;

  const replaysUrl = makeReplaysPathname({path: '/', organization});

  const items = [
    {
      key: 'explore-events',
      label: t('Explore Events'),
      to: {
        pathname: discoverUrl.pathname,
        query: {
          ...discoverUrl.query,
          sort: location.query.sort ?? '-timestamp',
        },
      },
    },
    ...(showReplays
      ? [
          {
            key: 'explore-replays',
            label: t('Explore Replays'),
            to: {
              pathname: replaysUrl,
              query: {query: `issue.id:${group.id}`},
            },
          },
        ]
      : []),
  ];

  return (
    <DropdownMenu
      items={items}
      triggerProps={{
        size: 'sm',
        icon: <IconEllipsis />,
        'aria-label': t('More actions'),
        showChevron: false,
      }}
      position="bottom-end"
    />
  );
}

const Page = styled('div')`
  display: flex;
  flex-direction: column;
  background: ${p => p.theme.tokens.background.primary};
  min-height: 100vh;

  [data-disclosure] > button > span > span[aria-hidden='true'] {
    display: none;
  }

  div:has(> button[aria-label$='sidebar']) {
    display: none !important;
  }
`;

const TabsBody = styled('div')`
  padding: ${p => p.theme.space.lg}
    var(--issue-details-inset, ${p => p.theme.space['2xl']});
`;

const PanelContent = styled('div')`
  padding-top: ${p => p.theme.space.xl};
`;

const EventNavRow = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${p => p.theme.space.md};
  margin-bottom: ${p => p.theme.space.md};
`;

// Keeps the event navigation (First / Latest / Recommended + pagination) as a
// single content-width group so it sits immediately left of the reorder button
// rather than stretching across the row.
const NavGroup = styled('div')`
  display: flex;
  align-items: center;
  flex: 0 1 auto;
  gap: ${p => p.theme.space.md};
`;

// Flex column container for telemetry sections. `TelemetryLayoutStyles` injects
// CSS `order` / `display` rules that reorder and hide sections within this container.
const TelemetrySections = styled('div')`
  display: flex;
  flex-direction: column;
`;
