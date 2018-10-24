import {Flex} from 'grid-emotion';
import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {defined} from 'app/utils';
import {getParams} from 'app/views/organizationEvents/utils';
import EventsContext from 'app/views/organizationEvents/eventsContext';
import Feature from 'app/components/acl/feature';
import HeaderSeparator from 'app/components/organizations/headerSeparator';
import MultipleEnvironmentSelector from 'app/components/organizations/multipleEnvironmentSelector';
import MultipleProjectSelector from 'app/components/organizations/multipleProjectSelector';
import SentryTypes from 'app/sentryTypes';
import TimeRangeSelector from 'app/components/organizations/timeRangeSelector';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';

class OrganizationEventsContainer extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
    router: PropTypes.object,
  };

  static getInitialStateFromRouter(props) {
    const {query} = props.router.location;
    const hasAbsolute = !!query.start && !!query.end;
    let project = [];
    let environment = query.environment || [];

    if (defined(query.project) && Array.isArray(query.project)) {
      project = query.project.map(p => parseInt(p, 10));
    } else if (defined(query.project)) {
      const projectIdInt = parseInt(query.project, 10);
      project = isNaN(projectIdInt) ? [] : [projectIdInt];
    }

    if (defined(query.environment) && !Array.isArray(query.environment)) {
      environment = [query.environment];
    }

    const values = {
      project,
      environment,
      period: query.statsPeriod || (hasAbsolute ? null : DEFAULT_STATS_PERIOD),
      start: query.start || null,
      end: query.end || null,
    };

    return {
      ...values,
      queryValues: {...values},
    };
  }

  constructor(props) {
    super(props);

    this.actions = {
      updateParams: this.updateParams,
    };

    this.state = OrganizationEventsContainer.getInitialStateFromRouter(props);
  }

  updateParams = obj => {
    const {router} = this.props;
    // Reset cursor when changing parameters
    // eslint-disable-next-line no-unused-vars
    const {cursor, statsPeriod, ...oldQuery} = router.location.query;

    const newQuery = getParams({
      ...oldQuery,
      period: obj.period || statsPeriod,
      ...obj,
    });

    router.push({
      pathname: router.location.pathname,
      query: newQuery,
    });
  };

  handleChangeProjects = projects => {
    this.setState(state => ({
      project: projects,
    }));
  };

  handleChangeEnvironments = environments => {
    this.setState(state => ({
      environment: environments,
    }));
  };

  handleChangeTime = ({start, end, relative}) => {
    this.setState({start, end, period: relative});
  };

  handleUpdatePeriod = () => {
    this.setState(({period, start, end, ...state}) => {
      let newValueObj = {};

      if (type === 'period') {
        newValueObj = {
          ...(typeof period !== 'undefined' ? {period} : {start, end}),
        };
      } else {
        newValueObj = {[type]: state[type]};
      }

      this.updateParams(newValueObj);

      return {
        queryValues: {
          ...state.queryValues,
          ...newValueObj,
        },
      };
    });
  };

  render() {
    const {organization, children} = this.props;
    const {period, start, end} = this.state;

    const projects =
      organization.projects && organization.projects.filter(({isMember}) => isMember);

    return (
      <Feature features={['events-stream']} renderDisabled>
        <EventsContext.Provider
          value={{actions: this.actions, ...this.state.queryValues}}
        >
          <OrganizationEventsContent>
            <Header>
              <MultipleProjectSelector
                organization={organization}
                projects={projects}
                value={this.state.project}
                onChange={this.handleChangeProjects}
                onUpdate={this.handleUpdate.bind(this, 'project')}
              />
              <HeaderSeparator />
              <MultipleEnvironmentSelector
                organization={organization}
                value={this.state.environment}
                onChange={this.handleChangeEnvironments}
                onUpdate={this.handleUpdate.bind(this, 'environment')}
              />
              <HeaderSeparator />
              <TimeRangeSelector
                showAbsolute
                showRelative
                relative={period}
                start={start}
                end={end}
                onChange={this.handleChangeTime}
                onUpdate={this.handleUpdate.bind(this, 'period')}
              />
            </Header>
            <Body>{children}</Body>
          </OrganizationEventsContent>
        </EventsContext.Provider>
      </Feature>
    );
  }
}
export default withRouter(withOrganization(OrganizationEventsContainer));
export {OrganizationEventsContainer};

const OrganizationEventsContent = styled(Flex)`
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  margin-bottom: -20px; /* <footer> has margin-top: 20px; */
`;

const Header = styled(Flex)`
  border-bottom: 1px solid ${p => p.theme.borderLight};
  font-size: 18px;
  height: 60px;
`;

const Body = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: ${space(3)};
`;
