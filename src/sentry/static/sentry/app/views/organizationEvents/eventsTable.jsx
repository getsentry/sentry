import {withRouter, Link} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import {PanelBody, Panel, PanelHeader} from 'app/components/panels';
import DateTime from 'app/components/dateTime';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import EventsContext from 'app/views/organizationEvents/eventsContext';
import IdBadge from 'app/components/idBadge';
import SentryTypes from 'app/sentryTypes';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';

class EventsTable extends React.PureComponent {
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
      <Panel>
        <PanelHeader>
          <TableLayout>
            <div>{t('Event')}</div>
            <div>{t('Project')}</div>
            <div>{t('User')}</div>
            <div>{t('Time')}</div>
          </TableLayout>
        </PanelHeader>
        {!hasEvents && <EmptyStateWarning>No events</EmptyStateWarning>}
        {hasEvents && (
          <StyledPanelBody>
            {events.map((event, eventIdx) => {
              const project = this.projectsMap.get(event.projectID);
              return (
                <TableRow key={`${project.slug}-${event.eventID}`} first={eventIdx == 0}>
                  <TableData>
                    <EventTitle>{this.getEventTitle(event)}</EventTitle>
                  </TableData>

                  <TableData>
                    <Project to={`/${organization.slug}/${project.slug}/`}>
                      <IdBadge
                        project={project}
                        avatarSize={16}
                        displayName={<span>{project.name}</span>}
                        avatarProps={{consistentWidth: true}}
                      />
                    </Project>
                  </TableData>

                  <TableData>
                    <IdBadge user={event.user} hideEmail avatarSize={16} />
                  </TableData>

                  <TableData>
                    <StyledDateTime date={new Date(event.dateCreated)} />
                  </TableData>
                </TableRow>
              );
            })}
          </StyledPanelBody>
        )}
      </Panel>
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

const StyledPanelBody = styled(PanelBody)`
  overflow-x: auto;
  padding: 0;
`;

const TableLayout = styled('div')`
  display: grid;
  grid-template-columns: 0.8fr 0.15fr 0.25fr 200px;
  grid-column-gap: ${space(1.5)};
  width: 100%;
`;

const TableRow = styled(TableLayout)`
  font-size: ${p => p.theme.fontSizeMedium};
  border-top: 1px solid ${p => (p.first ? 'transparent' : p.theme.borderLight)};
  align-items: center;
  padding: ${space(1)} ${space(2)};
`;

const TableData = styled('div')`
  overflow: hidden; /* enables overflow-ellipsis on child container */
`;

const EventTitle = styled(TableData)`
  padding-right: ${space(2)};
  ${overflowEllipsis};
`;

const Project = styled(Link)`
  display: flex;
  color: ${p => p.theme.gray4};
  ${overflowEllipsis};
`;

const StyledDateTime = styled(DateTime)`
  color: ${p => p.theme.gray2};
  ${overflowEllipsis};
`;
