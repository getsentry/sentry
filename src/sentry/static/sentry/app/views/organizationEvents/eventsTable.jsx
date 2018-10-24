import {isEqual} from 'lodash';
import {withRouter, Link} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {PanelBody} from 'app/components/panels';
import DateTime from 'app/components/dateTime';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import EventsContext from 'app/views/organizationEvents/eventsContext';
import IdBadge from 'app/components/idBadge';
import LoadingIndicator from 'app/components/loadingIndicator';
import SentryTypes from 'app/sentryTypes';
import Tooltip from 'app/components/tooltip';

const Table = styled(
  class Table extends React.Component {
    static propTypes = {
      events: PropTypes.array,
      organization: SentryTypes.Organization,
      projectsMap: PropTypes.object,
    };

    shouldComponentUpdate(nextProps) {
      if (
        this.props.organization === nextProps.organization &&
        isEqual(this.props.events, nextProps.events)
      ) {
        return false;
      }
      return true;
    }

    getEventTitle(event) {
      const {organization, projectsMap} = this.props;
      const project = projectsMap.get(event.projectID);
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
      const {className, events, organization, projectsMap} = this.props;
      return (
        <table className={className}>
          <tbody>
            {events.map((event, eventIdx) => {
              const project = projectsMap.get(event.projectID);
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
        </table>
      );
    }
  }
)`
  border: 0;
  width: 100%;
  max-width: 100%;
  margin: 0;
`;

class EventsTable extends React.Component {
  static propTypes = {
    reloading: PropTypes.bool,
    events: PropTypes.array,
    organization: SentryTypes.Organization,
  };

  constructor(props) {
    super(props);
    this.projectsMap = new Map(
      props.organization.projects.map(project => [project.id, project])
    );
  }

  render() {
    const {events, organization, reloading} = this.props;
    const hasEvents = events && !!events.length;

    return (
      <React.Fragment>
        {!hasEvents && <EmptyStateWarning>No events</EmptyStateWarning>}
        {hasEvents && (
          <Wrapper>
            {reloading && <StyledLoadingIndicator overlay />}
            <Table
              events={events}
              organization={organization}
              projectsMap={this.projectsMap}
            />
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

const StyledLoadingIndicator = styled(LoadingIndicator)`
  padding-top: 40vh;
  z-index: 1;
  &.loading.overlay {
    align-items: flex-start;
  }
`;

const Wrapper = styled(PanelBody)`
  overflow-x: auto;
  padding: 0;
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
