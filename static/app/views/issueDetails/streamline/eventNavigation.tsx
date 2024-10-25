import {Fragment, useMemo} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import DropdownButton from 'sentry/components/dropdownButton';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {TabList, Tabs} from 'sentry/components/tabs';
import {Tooltip} from 'sentry/components/tooltip';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';
import {useDefaultIssueEvent} from 'sentry/views/issueDetails/utils';

const enum EventNavOptions {
  RECOMMENDED = 'recommended',
  LATEST = 'latest',
  OLDEST = 'oldest',
  CUSTOM = 'custom',
}

const EventNavOrder = [
  EventNavOptions.OLDEST,
  EventNavOptions.RECOMMENDED,
  EventNavOptions.LATEST,
  EventNavOptions.CUSTOM,
];

const TabName = {
  [Tab.DETAILS]: t('Events'),
  [Tab.EVENTS]: t('Events'),
  [Tab.REPLAYS]: t('Replays'),
  [Tab.ATTACHMENTS]: t('Attachments'),
  [Tab.USER_FEEDBACK]: t('User Feedback'),
};

interface IssueEventNavigationProps {
  event: Event | undefined;
  group: Group;
  query: string | undefined;
}

export function IssueEventNavigation({event, group, query}: IssueEventNavigationProps) {
  const theme = useTheme();
  const organization = useOrganization();
  const {baseUrl, currentTab} = useGroupDetailsRoute();
  const location = useLocation();
  const params = useParams<{eventId?: string}>();
  const defaultIssueEvent = useDefaultIssueEvent();
  const isSmallScreen = useMedia(`(max-width: ${theme.breakpoints.small})`);

  const selectedOption = useMemo(() => {
    if (query?.trim()) {
      return EventNavOptions.CUSTOM;
    }
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
  }, [query, params.eventId, defaultIssueEvent]);

  const baseEventsPath = `/organizations/${organization.slug}/issues/${group.id}/events/`;

  const grayText = css`
    color: ${theme.subText};
    font-weight: ${theme.fontWeightNormal};
  `;

  const EventNavLabels = {
    [EventNavOptions.RECOMMENDED]: isSmallScreen ? t('Rec.') : t('Recommended'),
    [EventNavOptions.OLDEST]: t('First'),
    [EventNavOptions.LATEST]: t('Last'),
    [EventNavOptions.CUSTOM]: t('Specific'),
  };

  return (
    <EventNavigationWrapper>
      <LargeDropdownButtonWrapper>
        <DropdownMenu
          items={[
            {
              key: Tab.DETAILS,
              label: 'Events',
              to: {
                ...location,
                pathname: `${baseUrl}${TabPaths[Tab.DETAILS]}`,
              },
            },
            {
              key: Tab.REPLAYS,
              label: 'Replays',
              to: {
                ...location,
                pathname: `${baseUrl}${TabPaths[Tab.REPLAYS]}`,
              },
            },
            {
              key: Tab.ATTACHMENTS,
              label: 'Attachments',
              to: {
                ...location,
                pathname: `${baseUrl}${TabPaths[Tab.ATTACHMENTS]}`,
              },
            },
            {
              key: Tab.USER_FEEDBACK,
              label: 'Feedback',
              to: {
                ...location,
                pathname: `${baseUrl}${TabPaths[Tab.USER_FEEDBACK]}`,
              },
            },
          ]}
          offset={[-2, 1]}
          trigger={triggerProps => (
            <NavigationDropdownButton {...triggerProps} borderless size="sm">
              {TabName[currentTab] ?? TabName[Tab.DETAILS]}
            </NavigationDropdownButton>
          )}
        />
        <LargeInThisIssueText>{t('in this issue')}</LargeInThisIssueText>
      </LargeDropdownButtonWrapper>
      {event ? (
        <NavigationWrapper>
          {currentTab === Tab.DETAILS && (
            <Fragment>
              <Navigation>
                <Tooltip title={t('Previous Event')} skipWrapper>
                  <LinkButton
                    aria-label={t('Previous Event')}
                    borderless
                    size="xs"
                    icon={<IconChevron direction="left" />}
                    disabled={!defined(event.previousEventID)}
                    to={{
                      pathname: `${baseEventsPath}${event.previousEventID}/`,
                      query: {...location.query, referrer: 'previous-event'},
                    }}
                    css={grayText}
                  />
                </Tooltip>
                <Tooltip title={t('Next Event')} skipWrapper>
                  <LinkButton
                    aria-label={t('Next Event')}
                    borderless
                    size="xs"
                    icon={<IconChevron direction="right" />}
                    disabled={!defined(event.nextEventID)}
                    to={{
                      pathname: `${baseEventsPath}${event.nextEventID}/`,
                      query: {...location.query, referrer: 'next-event'},
                    }}
                    css={grayText}
                  />
                </Tooltip>
              </Navigation>
              <Tabs value={selectedOption} disableOverflow>
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
                        hidden={
                          label === EventNavOptions.CUSTOM &&
                          selectedOption !== EventNavOptions.CUSTOM
                        }
                        textValue={EventNavLabels[label]}
                      >
                        {EventNavLabels[label]}
                      </TabList.Item>
                    );
                  })}
                </TabList>
              </Tabs>
            </Fragment>
          )}
          {currentTab === Tab.DETAILS && (
            <LinkButton
              to={{
                pathname: `${baseUrl}${TabPaths[Tab.EVENTS]}`,
                query: location.query,
              }}
              size="xs"
            >
              {t('All Events')}
            </LinkButton>
          )}
          {currentTab === Tab.EVENTS && (
            <LinkButton to={{pathname: `${baseUrl}${TabPaths[Tab.DETAILS]}`}} size="xs">
              {t('Close')}
            </LinkButton>
          )}
        </NavigationWrapper>
      ) : null}
    </EventNavigationWrapper>
  );
}

const LargeDropdownButtonWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.25)};
`;

const NavigationDropdownButton = styled(DropdownButton)`
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: ${p => p.theme.fontWeightBold};
  padding-right: ${space(0.25)};
`;

const LargeInThisIssueText = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: ${p => p.theme.fontWeightBold};
  color: ${p => p.theme.subText};
`;

const EventNavigationWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  font-size: ${p => p.theme.fontSizeSmall};
  padding: ${space(1)} 0 ${space(0.5)} ${space(0.25)};

  @media (min-width: ${p => p.theme.breakpoints.xsmall}) {
    flex-direction: row;
    align-items: center;
    padding: ${space(1)} 0 ${space(0.5)} ${space(0.25)};
  }
`;

const NavigationWrapper = styled('div')`
  display: flex;
  gap: ${space(0.25)};
  justify-content: space-between;

  @media (min-width: ${p => p.theme.breakpoints.xsmall}) {
    gap: ${space(0.5)};
  }
`;

const Navigation = styled('div')`
  display: flex;
  padding-right: ${space(0.25)};
  border-right: 1px solid ${p => p.theme.gray100};
`;
