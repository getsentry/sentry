import {isValidElement, useEffect, useLayoutEffect, useState} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {Container} from '@sentry/scraps/layout';

import {AiPrivacyTooltip} from 'sentry/components/aiPrivacyTooltip';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {makeAutofixQueryKey} from 'sentry/components/events/autofix/useAutofix';
import Placeholder from 'sentry/components/placeholder';
import {
  IconChevron,
  IconDocs,
  IconFatal,
  IconFocus,
  IconRefresh,
  IconSpan,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {MarkedText} from 'sentry/utils/marked/markedText';
import {useApiQuery, useQueryClient, type ApiQueryKey} from 'sentry/utils/queryClient';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import testableTransition from 'sentry/utils/testableTransition';
import useOrganization from 'sentry/utils/useOrganization';
import {useAiConfig} from 'sentry/views/issueDetails/streamline/hooks/useAiConfig';

export interface GroupSummaryData {
  groupId: string;
  headline: string;
  eventId?: string | null;
  possibleCause?: string | null;
  scores?: {
    fixabilityScore?: number | null;
    fixabilityScoreVersion?: number | null;
    isFixable?: boolean | null;
    possibleCauseConfidence?: number | null;
    possibleCauseNovelty?: number | null;
  } | null;
  trace?: string | null;
  whatsWrong?: string | null;
}

const makeGroupSummaryQueryKey = (
  organizationSlug: string,
  groupId: string,
  eventId?: string
): ApiQueryKey => [
  `/organizations/${organizationSlug}/issues/${groupId}/summarize/`,
  {
    method: 'POST',
    data: eventId ? {event_id: eventId} : undefined,
  },
];

/**
 * Gets the data for group summary if it exists but doesn't fetch it.
 */
export function useGroupSummaryData(group: Group) {
  const organization = useOrganization();
  const queryKey = makeGroupSummaryQueryKey(organization.slug, group.id);

  const {data, isPending} = useApiQuery<GroupSummaryData>(queryKey, {
    staleTime: Infinity,
    enabled: false,
  });

  return {data, isPending};
}

export function useGroupSummary(
  group: Group,
  event: Event | null | undefined,
  project: Project,
  forceEvent = false
) {
  const organization = useOrganization();
  const aiConfig = useAiConfig(group, project);
  const enabled = aiConfig.hasSummary;
  const queryClient = useQueryClient();
  const queryKey = makeGroupSummaryQueryKey(
    organization.slug,
    group.id,
    forceEvent ? event?.id : undefined
  );

  const {data, isLoading, isFetching, isError, refetch} = useApiQuery<GroupSummaryData>(
    queryKey,
    {
      staleTime: Infinity,
      enabled,
    }
  );

  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: makeGroupSummaryQueryKey(organization.slug, group.id),
      exact: false,
    });
    refetch();
  };

  return {
    data,
    isPending: aiConfig.isAutofixSetupLoading || isLoading || isFetching,
    isError,
    refresh,
  };
}

export function GroupSummary({
  group,
  event,
  project,
  preview = false,
  collapsed = false,
}: {
  event: Event | null | undefined;
  group: Group;
  project: Project;
  collapsed?: boolean;
  preview?: boolean;
}) {
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const [forceEvent, setForceEvent] = useState(false);
  const aiConfig = useAiConfig(group, project);
  const {data, isPending, isError, refresh} = useGroupSummary(
    group,
    event,
    project,
    forceEvent
  );

  useEffect(() => {
    if (forceEvent && !isPending) {
      refresh();
      setForceEvent(false);
    }
  }, [forceEvent, isPending, refresh]);

  const hasFixabilityScore =
    data?.scores?.fixabilityScore !== null && data?.scores?.fixabilityScore !== undefined;

  useEffect(() => {
    if (hasFixabilityScore && !isPending && aiConfig.hasAutofix) {
      queryClient.invalidateQueries({
        queryKey: makeAutofixQueryKey(organization.slug, group.id),
      });
    }
  }, [
    hasFixabilityScore,
    isPending,
    aiConfig.hasAutofix,
    group.id,
    queryClient,
    organization.slug,
  ]);

  useRouteAnalyticsParams({
    has_summary: Boolean(data && !isPending && !isError),
  });

  if (preview) {
    return <GroupSummaryPreview data={data} isPending={isPending} isError={isError} />;
  }

  return (
    <GroupSummaryCollapsed
      group={group}
      project={project}
      event={event}
      data={data}
      isPending={isPending}
      isError={isError}
      setForceEvent={setForceEvent}
      defaultCollapsed={collapsed}
    />
  );
}

function GroupSummaryPreview({
  data,
  isPending,
  isError,
}: {
  data: GroupSummaryData | undefined;
  isError: boolean;
  isPending: boolean;
}) {
  const insightCards = [
    {
      id: 'possible_cause',
      title: t('Initial Guess'),
      insight: data?.possibleCause,
      icon: <IconFocus size="sm" />,
      showWhenLoading: true,
    },
  ];

  return (
    <div data-testid="group-summary-preview">
      {isError ? <div>{t('Error loading summary')}</div> : null}
      <Content>
        <InsightGrid>
          {insightCards.map(card => {
            if ((!isPending && !card.insight) || (isPending && !card.showWhenLoading)) {
              return null;
            }
            return (
              <InsightCard key={card.id}>
                <CardTitle>
                  <CardTitleIcon>{card.icon}</CardTitleIcon>
                  <AiPrivacyTooltip showUnderline isHoverable>
                    <CardTitleText>{card.title}</CardTitleText>
                  </AiPrivacyTooltip>
                </CardTitle>
                <CardContentContainer>
                  <CardLineDecorationWrapper>
                    <CardLineDecoration />
                  </CardLineDecorationWrapper>
                  {isPending ? (
                    <CardContent>
                      <Placeholder height="1.5rem" />
                    </CardContent>
                  ) : (
                    <CardContent>
                      {card.insight && (
                        <MarkedText text={card.insight.replace(/\*\*/g, '')} />
                      )}
                    </CardContent>
                  )}
                </CardContentContainer>
              </InsightCard>
            );
          })}
        </InsightGrid>
      </Content>
    </div>
  );
}

function GroupSummaryCollapsed({
  group,
  project,
  event,
  data,
  isPending,
  setForceEvent,
  isError,
  defaultCollapsed = false,
}: {
  data: GroupSummaryData | undefined;
  event: Event | null | undefined;
  group: Group;
  isError: boolean;
  isPending: boolean;
  project: Project;
  setForceEvent: (v: boolean) => void;
  defaultCollapsed?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(!defaultCollapsed);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  useLayoutEffect(() => {
    setIsExpanded(!defaultCollapsed);
  }, [defaultCollapsed]);

  return (
    <div data-testid="group-summary-collapsed">
      {isError ? <div>{t('Error loading summary')}</div> : null}
      {!isError && (
        <CollapsedContent>
          <CollapsedHeader onClick={handleToggle}>
            <CollapsedHeaderContent>
              {isPending ? (
                <Placeholder height="1.5rem" width="80%" />
              ) : (
                <Text size="md" bold ellipsis>
                  {data?.headline || t('Issue Summary')}
                </Text>
              )}
              <ChevronIcon>
                {isExpanded ? (
                  <IconChevron direction="up" size="sm" />
                ) : (
                  <IconChevron direction="down" size="sm" />
                )}
              </ChevronIcon>
            </CollapsedHeaderContent>
          </CollapsedHeader>

          <ExpandableContent
            initial={false}
            animate={{height: isExpanded ? 'auto' : 0}}
            transition={testableTransition({
              type: 'spring',
              damping: 50,
              stiffness: 600,
              bounce: 0,
              visualDuration: 0.4,
            })}
          >
            <Flex paddingTop="lg">
              <GroupSummaryFull
                group={group}
                project={project}
                data={data}
                isPending={isPending}
                isError={isError}
                preview={false}
                setForceEvent={setForceEvent}
                event={event}
              />
            </Flex>
          </ExpandableContent>
        </CollapsedContent>
      )}
    </div>
  );
}

function GroupSummaryFull({
  group,
  project,
  data,
  isPending,
  isError,
  setForceEvent,
  preview,
  event,
}: {
  data: GroupSummaryData | undefined;
  event: Event | null | undefined;
  group: Group;
  isError: boolean;
  isPending: boolean;
  preview: boolean;
  project: Project;
  setForceEvent: (v: boolean) => void;
}) {
  const config = getConfigForIssueType(group, project);
  const shouldShowResources = config.resources && !preview;

  const insightCards = [
    {
      id: 'whats_wrong',
      title: t('What Happened'),
      insight: data?.whatsWrong,
      icon: <IconFatal size="sm" />,
      showWhenLoading: true,
    },
    {
      id: 'trace',
      title: t('In the Trace'),
      insight: data?.trace,
      icon: <IconSpan size="sm" />,
      showWhenLoading: false,
    },
    {
      id: 'possible_cause',
      title: t('Initial Guess'),
      insight: data?.possibleCause,
      icon: <IconFocus size="sm" />,
      showWhenLoading: true,
    },

    ...(shouldShowResources
      ? [
          {
            id: 'resources',
            title: t('Resources'),
            // eslint-disable-next-line @typescript-eslint/no-base-to-string
            insight: `${isValidElement(config.resources?.description) ? '' : (config.resources?.description ?? '')}\n\n${config.resources?.links?.map(link => `[${link.text}](${link.link})`).join(' • ') ?? ''}`,
            insightElement: isValidElement(config.resources?.description)
              ? config.resources?.description
              : null,
            icon: <IconDocs size="sm" />,
            showWhenLoading: true,
          },
        ]
      : []),
  ];

  return (
    <Container data-testid="group-summary" width="100%">
      {isError ? <div>{t('Error loading summary')}</div> : null}
      <Content>
        <InsightGrid>
          {insightCards.map(card => {
            if ((!isPending && !card.insight) || (isPending && !card.showWhenLoading)) {
              return null;
            }
            return (
              <InsightCard key={card.id}>
                <CardTitle>
                  <CardTitleIcon>{card.icon}</CardTitleIcon>
                  <CardTitleText>{card.title}</CardTitleText>
                </CardTitle>
                <CardContentContainer>
                  <CardLineDecorationWrapper>
                    <CardLineDecoration />
                  </CardLineDecorationWrapper>
                  {isPending ? (
                    <CardContent>
                      <Placeholder height="3rem" />
                    </CardContent>
                  ) : (
                    <CardContent>
                      {card.insightElement}
                      {card.insight && (
                        <MarkedText text={card.insight.replace(/\*\*/g, '')} />
                      )}
                    </CardContent>
                  )}
                </CardContentContainer>
              </InsightCard>
            );
          })}
        </InsightGrid>
        {data?.eventId && !isPending && event && event.id !== data?.eventId && (
          <ResummarizeWrapper>
            <Button
              onClick={() => setForceEvent(true)}
              disabled={isPending}
              size="xs"
              icon={<IconRefresh />}
            >
              {t('Summarize current event')}
            </Button>
          </ResummarizeWrapper>
        )}
      </Content>
    </Container>
  );
}

const Content = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  position: relative;
`;

const InsightGrid = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const InsightCard = styled('div')`
  display: flex;
  flex-direction: column;
  border-radius: ${p => p.theme.radius.md};
  width: 100%;
  min-height: 0;
`;

const CardTitle = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  color: ${p => p.theme.tokens.content.secondary};
  padding-bottom: ${space(0.5)};
`;

const CardTitleText = styled('p')`
  margin: 0;
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const CardTitleIcon = styled('div')`
  display: flex;
  align-items: center;
  color: ${p => p.theme.tokens.content.secondary};
`;

const CardContentContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const CardLineDecorationWrapper = styled('div')`
  display: flex;
  width: 14px;
  align-self: stretch;
  justify-content: center;
  flex-shrink: 0;
  padding: 0.275rem 0;
`;

const CardLineDecoration = styled('div')`
  width: 1px;
  align-self: stretch;
  background-color: ${p => p.theme.tokens.border.primary};
`;

const CardContent = styled('div')`
  overflow-wrap: break-word;
  word-break: break-word;
  p {
    margin: 0;
    white-space: pre-wrap;
  }
  code {
    word-break: break-all;
  }
  flex: 1;
`;

const ResummarizeWrapper = styled('div')`
  display: flex;
  align-items: center;
  margin-top: ${space(1)};
  flex-shrink: 0;
`;

const CollapsedContent = styled('div')`
  display: flex;
  flex-direction: column;
  position: relative;
`;

const CollapsedHeader = styled('div')`
  cursor: pointer;
  transition: all 0.2s ease-in-out;
`;

const CollapsedHeaderContent = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${space(1)};
`;

const ChevronIcon = styled('div')`
  display: flex;
  align-items: center;
  color: ${p => p.theme.tokens.content.secondary};
  transition: transform 0.2s ease-in-out;
  flex-shrink: 0;
`;

const ExpandableContent = styled(motion.div)`
  overflow: hidden;
`;
