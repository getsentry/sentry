import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import Link from 'sentry/components/links/link';
import Placeholder from 'sentry/components/placeholder';
import {IconEllipsis, IconFatal, IconFocus, IconRefresh, IconSpan} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import marked from 'sentry/utils/marked';
import {type ApiQueryKey, useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import {useAiConfig} from 'sentry/views/issueDetails/streamline/hooks/useAiConfig';

interface GroupSummaryData {
  groupId: string;
  headline: string;
  eventId?: string | null;
  possibleCause?: string | null;
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
  const [showEventDetails, setShowEventDetails] = useState(false);
  const {data, isPending, isError, refresh} = useGroupSummary(
    group,
    event,
    project,
    forceEvent
  );

  const popupRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (forceEvent && !isPending) {
      refresh();
      setForceEvent(false);
    }
  }, [forceEvent, isPending, refresh]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        showEventDetails &&
        popupRef.current &&
        buttonRef.current &&
        !popupRef.current.contains(e.target as Node) &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setShowEventDetails(false);
      }
    }

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showEventDetails]);

  const tooltipContent = data?.eventId ? (
    event?.id === data.eventId ? (
      t('Based on this event')
    ) : (
      <TooltipContentWrapper>
        <span>
          {t('Based on event ')}
          <EventLink
            to={
              window.location.origin +
              normalizeUrl(
                `/organizations/${organization.slug}/issues/${data.groupId}/events/${data.eventId}/`
              )
            }
          >
            {data.eventId.substring(0, 8)}
          </EventLink>
        </span>
        <Button
          size="xs"
          icon={<IconRefresh size="xs" />}
          busy={isPending}
          aria-label={t('Summarize this event instead')}
          title={t('Summarize this event instead')}
          onClick={() => {
            setForceEvent(true);
          }}
        />
      </TooltipContentWrapper>
    )
  ) : (
    ''
  );

  const insightCards = [
    {
      id: 'whats_wrong',
      title: t("What's wrong"),
      insight: data?.whatsWrong,
      icon: <IconFatal size="sm" />,
      showWhenLoading: true,
    },
    {
      id: 'trace',
      title: t('In the trace'),
      insight: data?.trace,
      icon: <IconSpan size="sm" />,
      showWhenLoading: false,
    },
    {
      id: 'possible_cause',
      title: t('Possible cause'),
      insight: data?.possibleCause,
      icon: <IconFocus size="sm" />,
      showWhenLoading: true,
    },
  ];

  return (
    <div data-testid="group-summary">
      {isError ? <div>{t('Error loading summary')}</div> : null}
      <Content>
        {data?.eventId && !isPending && (
          <TooltipWrapper id="group-summary-tooltip-wrapper">
            <Button
              ref={buttonRef}
              size="xs"
              icon={<StyledIconEllipsis size="xs" />}
              aria-label={t('Event details')}
              borderless
              onClick={() => setShowEventDetails(!showEventDetails)}
            />
            {showEventDetails && (
              <EventDetailsPopup ref={popupRef}>{tooltipContent}</EventDetailsPopup>
            )}
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
                    card.insight && (
                      <CardContent
                        dangerouslySetInnerHTML={{
                          __html: marked(
                            preview
                              ? card.insight.replace(/\*\*/g, '') ?? ''
                              : card.insight ?? ''
                          ),
                        }}
                      />
                    )
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
  background: ${p => p.theme.background};
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
  width: 2px;
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
  top: 0;
  right: 0;
`;

const EventLink = styled(Link)`
  color: ${p => p.theme.linkColor};
  :hover {
    color: ${p => p.theme.linkHoverColor};
  }
`;

const TooltipContentWrapper = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${space(1)};
`;

const EventDetailsPopup = styled('div')`
  position: absolute;
  right: calc(100% + ${space(0.5)});
  top: 50%;
  transform: translateY(-50%);
  padding: ${space(1.5)};
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  z-index: 0;
  white-space: nowrap;
`;

const StyledIconEllipsis = styled(IconEllipsis)`
  color: ${p => p.theme.subText};
`;
