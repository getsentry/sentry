import {Link} from 'react-router';
import React from 'react';
import styled from 'react-emotion';

import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import AsyncView from 'app/views/asyncView';
import DateTime from 'app/components/dateTime';
import IdBadge from 'app/components/idBadge';
import Pagination from 'app/components/pagination';
import SentryTypes from 'app/sentryTypes';
import Tooltip from 'app/components/tooltip';
import withOrganization from 'app/utils/withOrganization';

class OrganizationEvents extends AsyncView {
  static propTypes = {
    organization: SentryTypes.Organization,
  };

  constructor(props) {
    super(props);
    this.projectsMap = new Map(
      props.organization.projects.map(project => [project.id, project])
    );
  }

  getTitle() {
    return `${this.props.organization.slug} Events`;
  }

  getEndpoints() {
    return [['events', `/organizations/${this.props.organization.slug}/events/`]];
  }

  getEventTitle(event) {
    const {organization} = this.props;
    const project = organization.projects.find(({id}) => id === event.projectID);
    return (
      <Link to={`/${organization.slug}/${project.slug}/issues/?query=${event.eventID}`}>
        {event.message.split('\n')[0].substr(0, 100)}
      </Link>
    );
  }

  renderBody() {
    const {organization} = this.props;
    const {events, eventsPageLinks} = this.state;
    return (
      <React.Fragment>
        <Panel>
          <PanelHeader hasButtons>
            Events
            {this.renderSearchInput({})}
          </PanelHeader>
          <Wrapper>
            <Table>
              <tbody>
                {events.map((event, eventIdx) => {
                  const project = this.projectsMap.get(event.projectID);
                  return (
                    <tr key={event.eventID}>
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
        </Panel>

        <Pagination pageLinks={eventsPageLinks} />
      </React.Fragment>
    );
  }
}
export default withOrganization(OrganizationEvents);

const Wrapper = styled(PanelBody)`
  overflow-x: scroll;
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

  tr:first-child & {
    border-top: none;
  }
`;

const DateRow = styled('div')`
  font-size: 0.85em;
  opacity: 0.8;
`;

const EventTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: 600;
`;
