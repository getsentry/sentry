import {isValidElement, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {makeAutofixQueryKey} from 'sentry/components/events/autofix/useAutofix';
import Placeholder from 'sentry/components/placeholder';
import {IconDocs, IconEllipsis, IconFatal, IconFocus, IconSpan} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {MarkedText} from 'sentry/utils/marked/markedText';
import {type ApiQueryKey, useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import useOrganization from 'sentry/utils/useOrganization';
import {useAiConfig} from 'sentry/views/issueDetails/streamline/hooks/useAiConfig';

const POSSIBLE_CAUSE_CONFIDENCE_THRESHOLD = 0.0;
const POSSIBLE_CAUSE_NOVELTY_THRESHOLD = 0.0;

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

export const makeGroupSummaryQueryKey = (
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
}: {
  event: Event | null | undefined;
  group: Group;
  project: Project;
  preview?: boolean;
}) {
  const config = getConfigForIssueType(group, project);
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const [forceEvent, setForceEvent] = useState(false);
  const openFeedbackForm = useFeedbackForm();
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

  const isFixable = data?.scores?.isFixable ?? false;

  useEffect(() => {
    if (isFixable && !isPending && aiConfig.hasAutofix) {
      queryClient.invalidateQueries({
        queryKey: makeAutofixQueryKey(organization.slug, group.id),
      });
    }
  }, [
    isFixable,
    isPending,
    aiConfig.hasAutofix,
    group.id,
    queryClient,
    organization.slug,
  ]);

  const eventDetailsItems = [
    {
      key: 'event-info',
      label:
        event?.id === data?.eventId ? (
          t('Based on this event')
        ) : (
          <span>{t('See original event (%s)', data?.eventId?.substring(0, 8))}</span>
        ),
      to:
        event?.id === data?.eventId
          ? undefined
          : window.location.origin +
            normalizeUrl(
              `/organizations/${organization.slug}/issues/${data?.groupId}/events/${data?.eventId}/`
            ),
      disabled: event?.id === data?.eventId,
    },
    ...(event?.id === data?.eventId
      ? []
      : [
          {
            key: 'refresh',
            label: t('Summarize this event instead'),
            onAction: () => setForceEvent(true),
            disabled: isPending,
          },
        ]),
    ...(openFeedbackForm
      ? [
          {
            key: 'feedback',
            label: t('Give feedback'),
            onAction: () => {
              openFeedbackForm({
                messagePlaceholder: t('How can we make Issue Summary better for you?'),
                tags: {
                  ['feedback.source']: 'issue_details_ai_autofix',
                  ['feedback.owner']: 'ml-ai',
                },
              });
            },
          },
        ]
      : []),
  ];

  const shouldShowPossibleCause =
    !data?.scores ||
    (data.scores.possibleCauseConfidence &&
      data.scores.possibleCauseConfidence >= POSSIBLE_CAUSE_CONFIDENCE_THRESHOLD &&
      data.scores.possibleCauseNovelty &&
      data.scores.possibleCauseNovelty >= POSSIBLE_CAUSE_NOVELTY_THRESHOLD);
  const shouldShowResources = config.resources && !preview;

  const insightCards = [
    {
      id: 'whats_wrong',
      title: t("What's Wrong"),
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
    ...(shouldShowPossibleCause
      ? [
          {
            id: 'possible_cause',
            title: t('Possible Cause'),
            insight: data?.possibleCause,
            icon: <IconFocus size="sm" />,
            showWhenLoading: true,
          },
        ]
      : []),
    ...(shouldShowResources
      ? [
          {
            id: 'resources',
            title: t('Resources'),
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
    <div data-testid="group-summary">
      {isError ? <div>{t('Error loading summary')}</div> : null}
      <Content>
        {data?.eventId && !isPending && !preview && (
          <TooltipWrapper id="group-summary-tooltip-wrapper">
            <DropdownMenu
              items={eventDetailsItems}
              triggerProps={{
                icon: <StyledIconEllipsis size="xs" />,
                'aria-label': t('Event details'),
                size: 'xs',
                borderless: true,
                showChevron: false,
                style: {
                  zIndex: 0,
                },
              }}
              isDisabled={isPending}
              position="bottom-end"
              offset={4}
            />
          </TooltipWrapper>
        )}
        <InsightGrid>
          {insightCards.map(card => {
            if ((!isPending && !card.insight) || (isPending && !card.showWhenLoading)) {
              return null;
            }

            return (
              <InsightCard key={card.id}>
                <CardTitle preview={preview}>
                  <CardTitleIcon>{card.icon}</CardTitleIcon>
                  <CardTitleText>{card.title}</CardTitleText>
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
                      {card.insightElement}
                      {card.insight && (
                        <MarkedText
                          text={
                            preview ? card.insight.replace(/\*\*/g, '') : card.insight
                          }
                        />
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
  border-radius: ${p => p.theme.borderRadius};
  width: 100%;
  min-height: 0;
`;

const CardTitle = styled('div')<{preview?: boolean}>`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  color: ${p => p.theme.subText};
  padding-bottom: ${space(0.5)};
`;

const CardTitleText = styled('p')`
  margin: 0;
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightBold};
`;

const CardTitleIcon = styled('div')`
  display: flex;
  align-items: center;
  color: ${p => p.theme.subText};
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
  background-color: ${p => p.theme.border};
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

const TooltipWrapper = styled('div')`
  position: absolute;
  top: -${space(0.5)};
  right: 0;

  ul {
    max-height: none !important;
    overflow: visible !important;
  }
`;

const StyledIconEllipsis = styled(IconEllipsis)`
  color: ${p => p.theme.subText};
`;
