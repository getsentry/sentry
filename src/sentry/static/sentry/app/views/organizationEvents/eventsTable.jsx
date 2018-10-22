import {withRouter, Link} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {PanelBody} from 'app/components/panels';
import DateTime from 'app/components/dateTime';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import EventsContext from 'app/views/organizationEvents/eventsContext';
import IdBadge from 'app/components/idBadge';
import SentryTypes from 'app/sentryTypes';
import Tooltip from 'app/components/tooltip';

class EventsTable extends React.Component {
  static propTypes = {
    events: PropTypes.array,
    organization: SentryTypes.Organization,
  };

  constructor(props) {
    super(props);
    this.projectsMap = new Map(
      props.organization.projects.map(project => [project.id, project])
    );
  }

  getEventTitle(event) {
    const {organization} = this.props;
    const project = this.projectsMap.get(event.projectID);
    const trimmedMessage = event.message.split('\n')[0].substr(0, 100);

    if (!project) {
      return trimmedMessage;
    }

    return (
      <Link to={`/${organization.slug}/${project.slug}/issues/?query=${event.eventID}`}>
        {trimmedMessage}
      </Link>
    );
  }

  render() {
    const {events, organization} = this.props;
    const hasEvents = events && !!events.length;

    return (
      <React.Fragment>
        {!hasEvents && <EmptyStateWarning>No events</EmptyStateWarning>}
        {hasEvents && (
          <Wrapper>
            <Table>
              <tbody>
                {events.map((event, eventIdx) => {
                  const project = this.projectsMap.get(event.projectID);
                  return (
                    <tr key={`${project.slug}-${event.eventID}`}>
                      <Td>
                        <Link to={`/${organization.slug}/${project.slug}/`}>
                          <Tooltip title={project.slug}>
                            <IdBadge project={project} hideName />
                          </Tooltip>
                        </Link>
                      </Td>

                      <Td>
                        <EventTitle>{this.getEventTitle(event)}</EventTitle>
                      </Td>

                      <Td>
                        <IdBadge user={event.user} hideEmail />
                        <DateRow>
                          <DateTime date={new Date(event.dateCreated)} />
                        </DateRow>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Wrapper>
        )}
      </React.Fragment>
    );
  }
}

class EventsTableContainer extends React.Component {
  render() {
    return (
      <EventsContext.Consumer>
        {context => <EventsTable {...context} {...this.props} />}
      </EventsContext.Consumer>
    );
  }
}
export default withRouter(EventsTableContainer);
export {EventsTable};

const Wrapper = styled(PanelBody)`
  overflow-x: auto;
  padding: 0;
`;
const Table = styled('table')`
  border: 0;
  width: 100%;
  max-width: 100%;
  margin: 0;
`;

const Td = styled('td')`
  padding: 10px 15px;
  white-space: nowrap;
  border-top: 1px solid ${p => p.theme.borderLight};
  vertical-align: middle;
`;

const DateRow = styled('div')`
  font-size: 0.85em;
  opacity: 0.8;
`;

const EventTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: 600;
`;
