import {Component, Fragment} from 'react';
import {Link} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import moment from 'moment-timezone';

import DateTime from 'app/components/dateTime';
import FileSize from 'app/components/fileSize';
import GlobalAppStoreConnectUpdateAlert from 'app/components/globalAppStoreConnectUpdateAlert';
import ExternalLink from 'app/components/links/externalLink';
import NavigationButtonGroup from 'app/components/navigationButtonGroup';
import Tooltip from 'app/components/tooltip';
import {IconWarning} from 'app/icons';
import {t} from 'app/locale';
import ConfigStore from 'app/stores/configStore';
import space from 'app/styles/space';
import {Group, Organization, Project} from 'app/types';
import {Event} from 'app/types/event';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import getDynamicText from 'app/utils/getDynamicText';

import QuickTrace from './quickTrace';

const formatDateDelta = (reference: moment.Moment, observed: moment.Moment) => {
  const duration = moment.duration(Math.abs(+observed - +reference));
  const hours = Math.floor(+duration / (60 * 60 * 1000));
  const minutes = duration.minutes();
  const results: string[] = [];

  if (hours) {
    results.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  }

  if (minutes) {
    results.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
  }

  if (results.length === 0) {
    results.push('a few seconds');
  }

  return results.join(', ');
};

type Props = {
  organization: Organization;
  project: Project;
  group: Group;
  event: Event;
  location: Location;
};

class GroupEventToolbar extends Component<Props> {
  shouldComponentUpdate(nextProps: Props) {
    return this.props.event.id !== nextProps.event.id;
  }

  handleTraceLink(organization: Organization) {
    trackAnalyticsEvent({
      eventKey: 'quick_trace.trace_id.clicked',
      eventName: 'Quick Trace: Trace ID clicked',
      organization_id: parseInt(organization.id, 10),
      source: 'issues',
    });
  }

  getDateTooltip() {
    const evt = this.props.event;
    const user = ConfigStore.get('user');
    const options = user?.options ?? {};
    const format = options.clock24Hours ? 'HH:mm:ss z' : 'LTS z';
    const dateCreated = moment(evt.dateCreated);
    const dateReceived = evt.dateReceived ? moment(evt.dateReceived) : null;

    return (
      <DescriptionList className="flat">
        <dt>Occurred</dt>
        <dd>
          {dateCreated.format('ll')}
          <br />
          {dateCreated.format(format)}
        </dd>
        {dateReceived && (
          <Fragment>
            <dt>Received</dt>
            <dd>
              {dateReceived.format('ll')}
              <br />
              {dateReceived.format(format)}
            </dd>
            <dt>Latency</dt>
            <dd>{formatDateDelta(dateCreated, dateReceived)}</dd>
          </Fragment>
        )}
      </DescriptionList>
    );
  }

  render() {
    const evt = this.props.event;

    const {group, organization, location, project} = this.props;
    const groupId = group.id;

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
        <StyledNavigationButtonGroup
          hasPrevious={!!evt.previousEventID}
          hasNext={!!evt.nextEventID}
          links={[
            {pathname: `${baseEventsPath}oldest/`, query: location.query},
            {pathname: `${baseEventsPath}${evt.previousEventID}/`, query: location.query},
            {pathname: `${baseEventsPath}${evt.nextEventID}/`, query: location.query},
            {pathname: `${baseEventsPath}latest/`, query: location.query},
          ]}
          size="small"
        />
        <Heading>
          {t('Event')}{' '}
          <EventIdLink to={`${baseEventsPath}${evt.id}/`}>{evt.eventID}</EventIdLink>
          <LinkContainer>
            <ExternalLink href={jsonUrl}>
              {'JSON'} (<FileSize bytes={evt.size} />)
            </ExternalLink>
          </LinkContainer>
        </Heading>
        <Tooltip title={this.getDateTooltip()} disableForVisualTest>
          <StyledDateTime
            date={getDynamicText({value: evt.dateCreated, fixed: 'Dummy timestamp'})}
          />
          {isOverLatencyThreshold && <StyledIconWarning color="yellow300" />}
        </Tooltip>
        <StyledGlobalAppStoreConnectUpdateAlert
          project={project}
          organization={organization}
          isCompact
        />
        <QuickTrace
          event={evt}
          group={group}
          organization={organization}
          location={location}
        />
      </Wrapper>
    );
  }
}

const Wrapper = styled('div')`
  position: relative;
  margin-bottom: -5px;
  /* z-index seems unnecessary, but increasing (instead of removing) just in case(billy) */
  /* Fixes tooltips in toolbar having lower z-index than .btn-group .btn.active */
  z-index: 3;
  padding: 20px 30px 20px 40px;

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

const StyledNavigationButtonGroup = styled(NavigationButtonGroup)`
  float: right;
`;

const StyledIconWarning = styled(IconWarning)`
  margin-left: ${space(0.5)};
  position: relative;
  top: ${space(0.25)};
`;

const StyledDateTime = styled(DateTime)`
  border-bottom: 1px dotted #dfe3ea;
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

const DescriptionList = styled('dl')`
  text-align: left;
  margin: 0;
  min-width: 200px;
  max-width: 250px;
`;

export default GroupEventToolbar;
