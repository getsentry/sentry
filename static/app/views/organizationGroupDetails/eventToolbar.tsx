import {Component} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';
import moment from 'moment-timezone';

import Button from 'sentry/components/button';
import DateTime from 'sentry/components/dateTime';
import {DataSection} from 'sentry/components/events/styles';
import FileSize from 'sentry/components/fileSize';
import GlobalAppStoreConnectUpdateAlert from 'sentry/components/globalAppStoreConnectUpdateAlert';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import NavigationButtonGroup from 'sentry/components/navigationButtonGroup';
import Tooltip from 'sentry/components/tooltip';
import {IconPlay, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Group, Organization, Project} from 'sentry/types';
import {Event} from 'sentry/types/event';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {shouldUse24Hours} from 'sentry/utils/dates';
import getDynamicText from 'sentry/utils/getDynamicText';

import EventCreatedTooltip from './eventCreatedTooltip';
import QuickTrace from './quickTrace';

type Props = {
  event: Event;
  group: Group;
  location: Location;
  organization: Organization;
  project: Project;
  hasReplay?: boolean;
};

class GroupEventToolbar extends Component<Props> {
  shouldComponentUpdate(nextProps: Props) {
    return this.props.event.id !== nextProps.event.id;
  }

  handleNavigationClick(button: string) {
    trackAdvancedAnalyticsEvent('issue_details.event_navigation_clicked', {
      organization: this.props.organization,
      project_id: parseInt(this.props.project.id, 10),
      button,
    });
  }

  render() {
    const is24Hours = shouldUse24Hours();
    const evt = this.props.event;

    const {group, organization, location, project, hasReplay} = this.props;
    const groupId = group.id;
    const isReplayEnabled = organization.features.includes('session-replay-ui');

    const baseEventsPath = `/organizations/${organization.slug}/issues/${groupId}/events/`;

    // TODO: possible to define this as a route in react-router, but without a corresponding
    //       React component?
    const jsonUrl = `/organizations/${organization.slug}/issues/${groupId}/events/${evt.id}/json/`;

    const latencyThreshold = 30 * 60 * 1000; // 30 minutes
    const isOverLatencyThreshold =
      evt.dateReceived &&
      Math.abs(+moment(evt.dateReceived) - +moment(evt.dateCreated)) > latencyThreshold;

    return (
      <Wrapper>
        <div>
          <Heading>
            {t('Event ID')}{' '}
            <EventIdLink to={`${baseEventsPath}${evt.id}/`}>{evt.eventID}</EventIdLink>
            <LinkContainer>
              <ExternalLink
                href={jsonUrl}
                onClick={() =>
                  trackAdvancedAnalyticsEvent('issue_details.event_json_clicked', {
                    organization,
                    group_id: parseInt(`${evt.groupID}`, 10),
                  })
                }
              >
                {'JSON'} (<FileSize bytes={evt.size} />)
              </ExternalLink>
            </LinkContainer>
          </Heading>
          <Tooltip
            title={<EventCreatedTooltip event={evt} />}
            showUnderline
            disableForVisualTest
          >
            <StyledDateTime
              format={is24Hours ? 'MMM D, YYYY HH:mm:ss zz' : 'll LTS z'}
              date={getDynamicText({
                value: evt.dateCreated,
                fixed: 'Dummy timestamp',
              })}
            />
            {isOverLatencyThreshold && <StyledIconWarning color="warningText" />}
          </Tooltip>
          <StyledGlobalAppStoreConnectUpdateAlert
            project={project}
            organization={organization}
          />
          <QuickTrace
            event={evt}
            group={group}
            organization={organization}
            location={location}
          />
        </div>
        <NavigationContainer>
          {hasReplay && isReplayEnabled ? (
            <Button href="#breadcrumbs" size="sm" icon={<IconPlay size="xs" />}>
              {t('Replay')}
            </Button>
          ) : null}
          <NavigationButtonGroup
            hasPrevious={!!evt.previousEventID}
            hasNext={!!evt.nextEventID}
            links={[
              {
                pathname: `${baseEventsPath}oldest/`,
                query: {...location.query, referrer: 'oldest-event'},
              },
              {
                pathname: `${baseEventsPath}${evt.previousEventID}/`,
                query: {...location.query, referrer: 'previous-event'},
              },
              {
                pathname: `${baseEventsPath}${evt.nextEventID}/`,
                query: {...location.query, referrer: 'next-event'},
              },
              {
                pathname: `${baseEventsPath}latest/`,
                query: {...location.query, referrer: 'latest-event'},
              },
            ]}
            onOldestClick={() => this.handleNavigationClick('oldest')}
            onOlderClick={() => this.handleNavigationClick('older')}
            onNewerClick={() => this.handleNavigationClick('newer')}
            onNewestClick={() => this.handleNavigationClick('newest')}
            size="sm"
          />
        </NavigationContainer>
      </Wrapper>
    );
  }
}

const Wrapper = styled(DataSection)`
  position: relative;
  flex-direction: row;
  justify-content: space-between;
  align-items: flex-start;
  gap: ${space(3)};

  @media (max-width: 767px) {
    display: none;
  }
`;

const EventIdLink = styled(Link)`
  font-weight: normal;
`;

const Heading = styled('h4')`
  line-height: 1.3;
  margin: 0;
  font-size: ${p => p.theme.fontSizeLarge};
`;

const StyledIconWarning = styled(IconWarning)`
  margin-left: ${space(0.5)};
  position: relative;
  top: ${space(0.25)};
`;

const StyledDateTime = styled(DateTime)`
  color: ${p => p.theme.subText};
`;

const StyledGlobalAppStoreConnectUpdateAlert = styled(GlobalAppStoreConnectUpdateAlert)`
  margin-top: ${space(0.5)};
  margin-bottom: ${space(1)};
`;

const LinkContainer = styled('span')`
  margin-left: ${space(1)};
  padding-left: ${space(1)};
  position: relative;
  font-weight: normal;

  &:before {
    display: block;
    position: absolute;
    content: '';
    left: 0;
    top: 2px;
    height: 14px;
    border-left: 1px solid ${p => p.theme.border};
  }
`;

const NavigationContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0 ${space(1)};
`;

export default GroupEventToolbar;
