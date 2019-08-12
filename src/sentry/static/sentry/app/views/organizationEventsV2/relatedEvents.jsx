import React from 'react';
import styled from 'react-emotion';
import PropTypes from 'prop-types';
import {omit} from 'lodash';

import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import AsyncComponent from 'app/components/asyncComponent';
import InlineSvg from 'app/components/inlineSvg';
import Link from 'app/components/links/link';
import Badge from 'app/components/badge';
import Placeholder from 'app/components/placeholder';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import DateTime from 'app/components/dateTime';
import space from 'app/styles/space';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import withProjects from 'app/utils/withProjects';

import {MODAL_QUERY_KEYS} from './data';

class RelatedEvents extends AsyncComponent {
  static propTypes = {
    event: SentryTypes.Event.isRequired,
    location: PropTypes.object.isRequired,
    organization: SentryTypes.Organization.isRequired,
    projects: PropTypes.arrayOf(SentryTypes.Project),
  };

  getEndpoints() {
    // TODO what happens when global-views feature is not on the org?
    const {event, organization} = this.props;
    const eventsUrl = `/organizations/${organization.slug}/eventsv2/`;
    const trace = event.tags.find(tag => tag.key === 'trace');

    if (!trace) {
      return [];
    }

    const params = {
      query: {
        field: [
          'project.name',
          'title',
          'transaction',
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
            return (
              <Card key={item.id} isCurrent={event.id === item.id}>
                <EventLink to={eventUrl} data-test-id="linked-event">
                  {item.title ? item.title : item.transaction}
                </EventLink>
                <StyledProjectBadge project={project} avatarSize={14} />
                <div>
                  <StyledDateTime date={item.timestamp} />
                  <Badge text={item['event.type']} />
                </div>
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

const Card = styled('div')`
  display: flex;
  flex-direction: column;
  border: 1px solid ${p => (p.isCurrent ? p.theme.purpleLight : p.theme.borderLight)};
  border-radius: ${p => p.theme.borderRadius};
  margin-bottom: ${space(1)};
  padding: ${space(1)};
`;

const EventLink = styled(Link)`
  font-size: ${p => p.theme.fontSizeMedium};
  margin-bottom: ${space(0.5)};
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
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: ${p => p.theme.text.lineHeightBody};
  color: ${p => p.theme.gray2};
`;

const StyledProjectBadge = styled(ProjectBadge)`
  font-size: ${p => p.theme.fontSizeMedium};
  margin-bottom: ${space(0.5)};
`;

export default withProjects(RelatedEvents);
