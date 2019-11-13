import React from 'react';
import styled from 'react-emotion';
import PropTypes from 'prop-types';
import omit from 'lodash/omit';
import {Location} from 'history';

import {Organization, Event, Project} from 'app/types';
import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import AsyncComponent from 'app/components/asyncComponent';
import InlineSvg from 'app/components/inlineSvg';
import Link from 'app/components/links/link';
import Placeholder from 'app/components/placeholder';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import DateTime from 'app/components/dateTime';
import space from 'app/styles/space';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import withProjects from 'app/utils/withProjects';

import {MODAL_QUERY_KEYS} from './data';
import {EventQuery} from './utils';

type Props = {
  location: Location;
  organization: Organization;
  event: Event;
  projects: Array<Project>;
};

class RelatedEvents extends AsyncComponent<Props> {
  static propTypes: any = {
    event: SentryTypes.Event.isRequired,
    location: PropTypes.object.isRequired,
    organization: SentryTypes.Organization.isRequired,
    projects: PropTypes.arrayOf(SentryTypes.Project),
  };

  hasGlobalViews(): boolean {
    return this.props.organization.features.includes('global-views');
  }

  getEndpoints(): Array<[string, string, {query: EventQuery}]> {
    const {event, organization} = this.props;
    const eventsUrl = `/organizations/${organization.slug}/eventsv2/`;
    const trace = event.tags.find(tag => tag.key === 'trace');

    if (!trace) {
      return [];
    }

    const params: {query: EventQuery} = {
      query: {
        field: [
          'project.name',
          'title',
          'transaction',
          'message',
          'id',
          'issue.id',
          'event.type',
          'timestamp',
        ],
        sort: ['-timestamp'],
        query: `trace:${trace.value}`,
      },
    };

    return [['events', eventsUrl, params]];
  }

  renderLoading() {
    return <Placeholder height="120px" bottomGutter={2} />;
  }

  renderError(error) {
    // Hide the related events if the user doesn't have global-views
    if (!this.hasGlobalViews()) {
      return null;
    }

    return super.renderError(error);
  }

  renderBody() {
    const {location, projects, event} = this.props;
    const {events} = this.state;
    if (!events || !events.data) {
      return null;
    }

    return (
      <Container>
        <Title>
          <InlineSvg src="icon-link" size="12px" /> {t('Related Events')}
        </Title>
        {events.data.length < 1 ? (
          <Card>{t('No related events found.')}</Card>
        ) : (
          events.data.map(item => {
            const eventUrl = {
              pathname: location.pathname,
              query: {
                ...omit(location.query, MODAL_QUERY_KEYS),
                eventSlug: `${item['project.name']}:${item.id}`,
              },
            };
            const project = projects.find(p => p.slug === item['project.name']);

            let iconSrc = 'icon-circle-exclamation';
            if (item['event.type'] === 'transaction') {
              iconSrc = 'icon-stats';
            }

            return (
              <Card key={item.id} isCurrent={event.id === item.id}>
                <CardHeader>
                  <InlineSvg src={iconSrc} size="15" />
                  <EventLink to={eventUrl} data-test-id="linked-event">
                    {item.title ? item.title : item.transaction}
                    {item.title !== item.transaction && <em>{item.transaction}</em>}
                  </EventLink>
                </CardHeader>
                {item.message !== item.title && <ExtraInfo>{item.message}</ExtraInfo>}
                <ExtraInfo>
                  <StyledProjectBadge project={project} avatarSize={14} />
                  <StyledDateTime date={item.timestamp} />
                </ExtraInfo>
              </Card>
            );
          })
        )}
      </Container>
    );
  }
}

const Container = styled('div')`
  position: relative;
`;

const Card = styled('div')<{isCurrent?: boolean; theme?: any}>`
  display: flex;
  flex-direction: column;
  font-size: ${p => p.theme.fontSizeMedium};
  line-height: 1.4;
  border: 1px solid ${p => (p.isCurrent ? p.theme.purpleLight : p.theme.borderLight)};
  border-radius: ${p => p.theme.borderRadius};
  margin-bottom: ${space(1)};
  padding: ${space(1)};
`;

const CardHeader = styled('div')`
  display: flex;
  align-items: center;
`;

const EventLink = styled(Link)`
  margin-left: ${space(1)};
  ${overflowEllipsis};
`;

const Title = styled('h4')`
  background: #fff;
  color: ${p => p.theme.gray3};
  padding: 0 ${space(1)};
  margin-bottom: ${space(0.5)};

  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: normal;
`;

const StyledDateTime = styled(DateTime)`
  color: ${p => p.theme.gray2};
`;

const StyledProjectBadge = styled(ProjectBadge)`
  margin-right: ${space(1)};
`;

const ExtraInfo = styled('div')`
  display: flex;
  justify-content: space-between;
  margin-top: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeSmall};
`;

export default withProjects(RelatedEvents);
