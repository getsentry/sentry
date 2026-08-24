import {Fragment, useCallback, useEffect, useState} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {LinkButton} from '@sentry/scraps/button';
import {TabList, Tabs} from '@sentry/scraps/tabs';

import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {defined} from 'sentry/utils/defined';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useGroupEvent} from 'sentry/views/issueDetails/useGroupEvent';
import {useDefaultIssueEvent} from 'sentry/views/issueDetails/utils';

interface IssueDetailsEventNavigationProps {
  event: Event | undefined;
  group: Group;
  isSmallNav?: boolean;
}

export function IssueDetailsEventNavigation({
  event,
  group,
  isSmallNav,
}: IssueDetailsEventNavigationProps) {
  const organization = useOrganization();
  const location = useLocation();
  const params = useParams<{eventId?: string}>();
  const theme = useTheme();
  const defaultIssueEvent = useDefaultIssueEvent();
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

  const eventNavPresets = [
    {
      key: 'oldest',
      label: t('First'),
      tooltip: t('Earliest event matching filters'),
    },
    {
      key: 'latest',
      label: t('Latest'),
      tooltip: t('Newest event matching filters'),
    },
    {
      key: 'recommended',
      label: isSmallNav ? t('Rec.') : t('Recommended'),
      tooltip: t('Recent event with richer content'),
    },
  ] as const;
  const currentEventKey = params.eventId ?? defaultIssueEvent;

  const onTabChange = (tabKey: string) => {
    const preset = eventNavPresets.find(({key}) => key === tabKey);
    if (!preset) {
      return;
    }
    trackAnalytics('issue_details.event_navigation_selected', {
      organization,
      content: preset.label,
    });
  };

  const baseEventsPath = `/organizations/${organization.slug}/issues/${group.id}/events/`;

  const grayText = css`
    color: ${theme.tokens.content.secondary};
    font-weight: ${theme.font.weight.sans.regular};
  `;

  return (
    <Fragment>
      <Navigation>
        <LinkButton
          aria-label={t('Previous Event')}
          tooltipProps={{title: t('Previous Event')}}
          variant="transparent"
          size="xs"
          icon={<IconChevron direction="left" />}
          disabled={!defined(event?.previousEventID)}
          analyticsEventKey="issue_details.previous_event_clicked"
          analyticsEventName="Issue Details: Previous Event Clicked"
          to={{
            pathname: `${baseEventsPath}${event?.previousEventID}/`,
            query: {...location.query, referrer: 'previous-event'},
          }}
          preventScrollReset
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
        <LinkButton
          aria-label={t('Next Event')}
          tooltipProps={{title: t('Next Event')}}
          variant="transparent"
          size="xs"
          icon={<IconChevron direction="right" />}
          disabled={!defined(event?.nextEventID)}
          analyticsEventKey="issue_details.next_event_clicked"
          analyticsEventName="Issue Details: Next Event Clicked"
          to={{
            pathname: `${baseEventsPath}${event?.nextEventID}/`,
            query: {...location.query, referrer: 'next-event'},
          }}
          preventScrollReset
          css={grayText}
          onMouseEnter={handleHoverPagination('next', defined(event?.nextEventID))}
          onClick={() => {
            // Assume they will continue to paginate
            setShouldPreload({next: true, previous: true});
          }}
        />
      </Navigation>
      <Tabs value={currentEventKey} disableOverflow onChange={onTabChange} size="xs">
        <TabList variant="floating">
          {eventNavPresets.map(({key, label, tooltip}) => {
            const eventPath =
              key === currentEventKey
                ? undefined
                : {
                    pathname: normalizeUrl(baseEventsPath + key + '/'),
                    query: {...location.query, referrer: `${key}-event`},
                  };
            return (
              <TabList.Item
                to={eventPath}
                key={key}
                textValue={label}
                tooltip={{title: tooltip}}
              >
                {label}
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
  padding-right: ${p => p.theme.space['2xs']};
  border-right: 1px solid ${p => p.theme.colors.gray100};
`;
