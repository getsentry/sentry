import {withRouter, Link} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {PanelBody, Panel, PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';
import DateTime from 'app/components/dateTime';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import IdBadge from 'app/components/idBadge';
import LoadingIndicator from 'app/components/loadingIndicator';
import Placeholder from 'app/components/placeholder';
import SentryTypes from 'app/sentryTypes';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import withProjects from 'app/utils/withProjects';

class EventsTableBody extends React.PureComponent {
  static propTypes = {
    events: PropTypes.array,
    organization: SentryTypes.Organization,
    utc: PropTypes.bool,
    projectsMap: PropTypes.object,
  };

  render() {
    const {events, organization, utc, projectsMap} = this.props;

    return events.map((event, eventIdx) => {
      const project = projectsMap.get(event.projectID);
      const trimmedMessage = event.title || event.message.split('\n')[0].substr(0, 100);
      const eventLink = project
        ? `/organizations/${organization.slug}/projects/${project?.slug}/events/${event.eventID}/`
        : '';

      return (
        <TableRow key={`${project?.slug}-${event.eventID}`} first={eventIdx === 0}>
          <TableData>
            <EventTitle>
              {project ? <Link to={eventLink}>{trimmedMessage}</Link> : trimmedMessage}
            </EventTitle>
          </TableData>

          <TableData>{event['event.type']}</TableData>

          <TableData>
            {project ? (
              <IdBadge
                project={project}
                avatarSize={16}
                displayName={<span>{project?.slug}</span>}
                avatarProps={{consistentWidth: true}}
              />
            ) : (
              <Placeholder height="16px" width="50px" />
            )}
          </TableData>

          <TableData>
            {event && event.user && (
              <IdBadge user={event.user} hideEmail avatarSize={16} />
            )}
          </TableData>

          <TableData>
            <StyledDateTime utc={utc} date={new Date(event.dateCreated)} />
          </TableData>
        </TableRow>
      );
    });
  }
}

class EventsTable extends React.Component {
  static propTypes = {
    // Initial loading state
    loading: PropTypes.bool,

    // projectsStore loading state of projects
    loadingProjects: PropTypes.bool,

    // When initial data has been loaded, but params have changed
    reloading: PropTypes.bool,

    // Special state when chart has been zoomed
    zoomChanged: PropTypes.bool,

    events: PropTypes.array,
    organization: SentryTypes.Organization,
    projects: PropTypes.arrayOf(SentryTypes.Project),
    utc: PropTypes.bool,

    // When Table is in loading state due to chart zoom but has
    // completed its new API request
    onUpdateComplete: PropTypes.func,
  };

  shouldComponentUpdate(nextProps) {
    // Update if any of these "loading"-type props change so we can display loader
    if (
      this.props.reloading !== nextProps.reloading ||
      this.props.zoomChanged !== nextProps.zoomChanged ||
      this.props.loading !== nextProps.loading ||
      this.props.loadingProjects !== nextProps.loadingProjects
    ) {
      return true;
    }

    // If org or events has not changed, then don't re-render
    // Shallow compare events
    if (
      this.props.organization === nextProps.organization &&
      this.props.events === nextProps.events
    ) {
      return false;
    }

    // Otherwise update
    return true;
  }

  componentDidUpdate(prevProps) {
    if (this.props.onUpdateComplete && prevProps.zoomChanged && this.props.reloading) {
      this.props.onUpdateComplete();
    }
  }

  get projectsMap() {
    const {organization, loadingProjects, projects} = this.props;
    const projectList = (!loadingProjects && projects) || organization.projects || [];

    return new Map(projectList.map(project => [project.id, project]));
  }

  render() {
    const {events, organization, loading, reloading, zoomChanged, utc} = this.props;
    const hasEvents = events && !!events.length;

    return (
      <Panel>
        <PanelHeader>
          <TableLayout>
            <div>{t('Event')}</div>
            <div>{t('Event Type')}</div>
            <div>{t('Project')}</div>
            <div>{t('User')}</div>
            <div>{t('Time')}</div>
          </TableLayout>
        </PanelHeader>
        {loading && <LoadingIndicator />}
        {!loading && !hasEvents && (
          <EmptyStateWarning>
            <p>{t('No events')}</p>
          </EmptyStateWarning>
        )}
        {hasEvents && (
          <StyledPanelBody>
            {(reloading || zoomChanged) && <StyledLoadingIndicator overlay />}
            <EventsTableBody
              projectsMap={this.projectsMap}
              events={events}
              organization={organization}
              utc={utc}
            />
          </StyledPanelBody>
        )}
      </Panel>
    );
  }
}

export default withProjects(withRouter(EventsTable));
export {EventsTable};

const StyledPanelBody = styled(PanelBody)`
  overflow-x: auto;
  padding: 0;
`;

const TableLayout = styled('div')`
  display: grid;
  grid-template-columns: 0.8fr 0.15fr 0.15fr 0.25fr 200px;
  grid-column-gap: ${space(1.5)};
  width: 100%;
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  padding-top: 10vh;
  z-index: 1;
  &.loading.overlay {
    align-items: flex-start;
  }
`;

const TableRow = styled(TableLayout)`
  font-size: ${p => p.theme.fontSizeMedium};
  border-top: 1px solid ${p => (p.first ? 'transparent' : p.theme.innerBorder)};
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

const StyledDateTime = styled(DateTime)`
  color: ${p => p.theme.gray500};
  ${overflowEllipsis};
`;
