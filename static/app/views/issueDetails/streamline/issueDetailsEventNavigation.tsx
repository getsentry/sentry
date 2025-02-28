import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import {TabList, Tabs} from 'sentry/components/tabs';
import {Tooltip} from 'sentry/components/tooltip';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useGroupEvent} from 'sentry/views/issueDetails/useGroupEvent';
import {useDefaultIssueEvent} from 'sentry/views/issueDetails/utils';

const enum EventNavOptions {
  RECOMMENDED = 'recommended',
  LATEST = 'latest',
  OLDEST = 'oldest',
  CUSTOM = 'custom',
}

const EventNavOrder = [
  EventNavOptions.OLDEST,
  EventNavOptions.LATEST,
  EventNavOptions.RECOMMENDED,
  EventNavOptions.CUSTOM,
];

interface IssueDetailsEventNavigationProps {
  event: Event | undefined;
  group: Group;
}

export function IssueDetailsEventNavigation({
  event,
  group,
}: IssueDetailsEventNavigationProps) {
  const organization = useOrganization();
  const location = useLocation();
  const params = useParams<{eventId?: string}>();
  const theme = useTheme();
  const defaultIssueEvent = useDefaultIssueEvent();
  const isSmallScreen = useMedia(`(max-width: ${theme.breakpoints.small})`);
  const [shouldPreload, setShouldPreload] = useState({next: false, previous: false});

  // Reset shouldPreload when the groupId changes
  useEffect(() => {
    setShouldPreload({next: false, previous: false});
  }, [group.id]);

  // Prefetch next
  useGroupEvent({
    groupId: group.id,
    eventId: event?.nextEventID ?? undefined,
    options: {enabled: shouldPreload.next},
  });
  // Prefetch previous
  useGroupEvent({
    groupId: group.id,
    eventId: event?.previousEventID ?? undefined,
    options: {enabled: shouldPreload.previous},
  });

  const handleHoverPagination = useCallback(
    (direction: 'next' | 'previous', isEnabled: boolean) => () => {
      if (isEnabled) {
        setShouldPreload(prev => ({...prev, [direction]: true}));
      }
    },
    []
  );

  const selectedOption = useMemo(() => {
    switch (params.eventId) {
      case EventNavOptions.RECOMMENDED:
      case EventNavOptions.LATEST:
      case EventNavOptions.OLDEST:
        return params.eventId;
      case undefined:
        return defaultIssueEvent;
      default:
        return EventNavOptions.CUSTOM;
    }
  }, [params.eventId, defaultIssueEvent]);

  const EventNavLabels = {
    [EventNavOptions.RECOMMENDED]: isSmallScreen ? t('Rec.') : t('Recommended'),
    [EventNavOptions.OLDEST]: t('First'),
    [EventNavOptions.LATEST]: t('Last'),
    [EventNavOptions.CUSTOM]: t('Custom'),
  };

  const EventNavTooltips = {
    [EventNavOptions.RECOMMENDED]: t('Recent event with richer content'),
    [EventNavOptions.OLDEST]: t('First event matching filters'),
    [EventNavOptions.LATEST]: t('Last event matching filters'),
  };

  const onTabChange = (tabKey: typeof selectedOption) => {
    trackAnalytics('issue_details.event_navigation_selected', {
      organization,
      content: EventNavLabels[tabKey as keyof typeof EventNavLabels],
    });
  };

  const baseEventsPath = `/organizations/${organization.slug}/issues/${group.id}/events/`;

  const grayText = css`
    color: ${theme.subText};
    font-weight: ${theme.fontWeightNormal};
  `;

  return (
    <Fragment>
      <Navigation>
        <Tooltip title={t('Previous Event')} skipWrapper>
          <LinkButton
            aria-label={t('Previous Event')}
            borderless
            size="xs"
            icon={<IconChevron direction="left" />}
            disabled={!defined(event?.previousEventID)}
            analyticsEventKey="issue_details.previous_event_clicked"
            analyticsEventName="Issue Details: Previous Event Clicked"
            to={{
              pathname: `${baseEventsPath}${event?.previousEventID}/`,
              query: {...location.query, referrer: 'previous-event'},
            }}
            css={grayText}
            onMouseEnter={handleHoverPagination(
              'previous',
              defined(event?.previousEventID)
            )}
            onClick={() => {
              // Assume they will continue to paginate
              setShouldPreload({next: true, previous: true});
            }}
          />
        </Tooltip>
        <Tooltip title={t('Next Event')} skipWrapper>
          <LinkButton
            aria-label={t('Next Event')}
            borderless
            size="xs"
            icon={<IconChevron direction="right" />}
            disabled={!defined(event?.nextEventID)}
            analyticsEventKey="issue_details.next_event_clicked"
            analyticsEventName="Issue Details: Next Event Clicked"
            to={{
              pathname: `${baseEventsPath}${event?.nextEventID}/`,
              query: {...location.query, referrer: 'next-event'},
            }}
            css={grayText}
            onMouseEnter={handleHoverPagination('next', defined(event?.nextEventID))}
            onClick={() => {
              // Assume they will continue to paginate
              setShouldPreload({next: true, previous: true});
            }}
          />
        </Tooltip>
      </Navigation>
      <Tabs value={selectedOption} disableOverflow onChange={onTabChange}>
        <TabList hideBorder variant="floating">
          {EventNavOrder.map(label => {
            const eventPath =
              label === selectedOption
                ? undefined
                : {
                    pathname: normalizeUrl(baseEventsPath + label + '/'),
                    query: {...location.query, referrer: `${label}-event`},
                  };
            return (
              <TabList.Item
                to={eventPath}
                key={label}
                hidden={label === EventNavOptions.CUSTOM}
                textValue={EventNavLabels[label as keyof typeof EventNavLabels]}
              >
                <Tooltip
                  title={EventNavTooltips[label as keyof typeof EventNavTooltips]}
                  skipWrapper
                >
                  {EventNavLabels[label as keyof typeof EventNavLabels]}
                </Tooltip>
              </TabList.Item>
            );
          })}
        </TabList>
      </Tabs>
    </Fragment>
  );
}

const Navigation = styled('div')`
  display: flex;
  padding-right: ${space(0.25)};
  border-right: 1px solid ${p => p.theme.gray100};
`;
