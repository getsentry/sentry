import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import Placeholder from 'sentry/components/placeholder';
import Timeline from 'sentry/components/timeline';
import {IconEllipsis, IconFatal, IconFocus, IconSpan} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import marked from 'sentry/utils/marked';
import {type ApiQueryKey, useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import useOrganization from 'sentry/utils/useOrganization';
import {useAiConfig} from 'sentry/views/issueDetails/streamline/hooks/useAiConfig';

const POSSIBLE_CAUSE_CONFIDENCE_THRESHOLD = 0.468;
const POSSIBLE_CAUSE_NOVELTY_THRESHOLD = 0.419;

interface GroupSummaryData {
  groupId: string;
  headline: string;
  eventId?: string | null;
  possibleCause?: string | null;
  scores?: {
    possibleCauseConfidence: number;
    possibleCauseNovelty: number;
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

export function useGroupSummary(
  group: Group,
  event: Event | null | undefined,
  project: Project,
  forceEvent: boolean = false
) {
  const organization = useOrganization();
  const aiConfig = useAiConfig(group, event, project);
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
      queryKey: [`/organizations/${organization.slug}/issues/${group.id}/summarize/`],
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
  const organization = useOrganization();
  const [forceEvent, setForceEvent] = useState(false);
  const openFeedbackForm = useFeedbackForm();
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
    ...(event?.id !== data?.eventId
      ? [
          {
            key: 'refresh',
            label: t('Summarize this event instead'),
            onAction: () => setForceEvent(true),
            disabled: isPending,
          },
        ]
      : []),
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
    (data.scores.possibleCauseConfidence >= POSSIBLE_CAUSE_CONFIDENCE_THRESHOLD &&
      data.scores.possibleCauseNovelty >= POSSIBLE_CAUSE_NOVELTY_THRESHOLD);

  const iconProps = {
    style: {
      marginLeft: 3,
      marginTop: 2,
    },
  };

  const insightCards = [
    {
      id: 'whats_wrong',
      title: t("What's wrong"),
      insight: data?.whatsWrong,
      icon: <IconFatal {...iconProps} />,
      showWhenLoading: true,
    },
    {
      id: 'trace',
      title: t('In the trace'),
      insight: data?.trace,
      icon: <IconSpan {...iconProps} />,
      showWhenLoading: false,
    },
    ...(shouldShowPossibleCause
      ? [
          {
            id: 'possible_cause',
            title: t('Possible cause'),
            insight: data?.possibleCause,
            icon: <IconFocus {...iconProps} />,
            showWhenLoading: false,
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
              }}
              isDisabled={isPending}
              position="bottom-end"
              offset={4}
            />
          </TooltipWrapper>
        )}
        <StyledTimelineContainer>
          {insightCards.map(card => {
            if ((!isPending && !card.insight) || (isPending && !card.showWhenLoading)) {
              return null;
            }

            return (
              <Timeline.Item
                key={card.id}
                title={card.title}
                icon={card.icon}
                colorConfig={{
                  title: 'gray300',
                  icon: 'gray300',
                  iconBorder: 'gray300',
                }}
              >
                {isPending ? (
                  <StyledPlaceholder height="1.5rem" />
                ) : (
                  card.insight && (
                    <StyledTimelineText>
                      <CardContent
                        dangerouslySetInnerHTML={{
                          __html: marked(
                            preview
                              ? card.insight.replace(/\*\*/g, '') ?? ''
                              : card.insight ?? ''
                          ),
                        }}
                      />
                    </StyledTimelineText>
                  )
                )}
              </Timeline.Item>
            );
          })}
        </StyledTimelineContainer>
      </Content>
    </div>
  );
}

const StyledTimelineContainer = styled(Timeline.Container)`
  position: relative;
  left: -${space(0.5)};
`;

const Content = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  position: relative;
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
`;

const TooltipWrapper = styled('div')`
  position: absolute;
  top: -${space(0.5)};
  right: 0;
`;

const StyledIconEllipsis = styled(IconEllipsis)`
  color: ${p => p.theme.subText};
`;

const StyledPlaceholder = styled(Placeholder)`
  margin: ${space(0.5)} 0;
`;

const StyledTimelineText = styled(Timeline.Text)`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.textColor};
`;
