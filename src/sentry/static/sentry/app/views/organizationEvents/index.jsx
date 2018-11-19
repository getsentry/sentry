import {Flex} from 'grid-emotion';
import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {DEFAULT_STATS_PERIOD, DEFAULT_USE_UTC} from 'app/constants';
import {defined} from 'app/utils';
import {getLocalDateObject, getUtcDateString} from 'app/utils/dates';
import {getParams} from 'app/views/organizationEvents/utils';
import EventsContext from 'app/views/organizationEvents/utils/eventsContext';
import Feature from 'app/components/acl/feature';
import Header from 'app/components/organizations/header';
import HeaderSeparator from 'app/components/organizations/headerSeparator';
import HeaderItemPosition from 'app/components/organizations/headerItemPosition';
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

  static getStateFromRouter(props) {
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

    let {start, end} = query;

    if (hasAbsolute) {
      start = getLocalDateObject(start);
      end = getLocalDateObject(end);
    }

    return {
      project,
      environment,
      period: query.statsPeriod || (hasAbsolute ? null : DEFAULT_STATS_PERIOD),
      start: start || null,
      end: end || null,
      utc: typeof query.utc !== 'undefined' ? query.utc === 'true' : DEFAULT_USE_UTC,
    };
  }

  constructor(props) {
    super(props);

    this.actions = {
      updateParams: this.updateParams,
    };

    const values = OrganizationEventsContainer.getStateFromRouter(props);
    this.state = {
      ...values,
      queryValues: {
        ...values,
      },
    };
  }

  componentWillReceiveProps(nextProps, nextState) {
    if (this.props.location !== nextProps.location) {
      const values = OrganizationEventsContainer.getStateFromRouter(nextProps);

      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({
        ...values,
        queryValues: {...values},
      });
    }
  }

  updateParams = obj => {
    const {router} = this.props;
    // Reset cursor when changing parameters
    // eslint-disable-next-line no-unused-vars
    const {cursor, statsPeriod, ...oldQuery} = router.location.query;

    const newQuery = getParams({
      ...oldQuery,
      period: !obj.start && !obj.end ? obj.period || statsPeriod : null,
      ...obj,
    });

    if (newQuery.start) {
      newQuery.start = getUtcDateString(newQuery.start);
    }

    if (newQuery.end) {
      newQuery.end = getUtcDateString(newQuery.end);
    }

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

  handleChangeTime = ({start, end, relative, utc}) => {
    this.setState({start, end, period: relative, utc});
  };

  handleUpdatePeriod = () => {
    this.setState(({period, start, end, utc, ...state}) => {
      let newValueObj = {
        ...(defined(period) ? {period} : {start, end}),
        utc,
      };

      this.updateParams(newValueObj);

      const {
        period: _period, // eslint-disable-line no-unused-vars
        start: _start, // eslint-disable-line no-unused-vars
        end: _end, // eslint-disable-line no-unused-vars
        ...queryValues
      } = state.queryValues;

      return {
        queryValues: {
          ...queryValues,
          ...newValueObj,
        },
      };
    });
  };

  handleUpdate = type => {
    this.setState(state => {
      let newValueObj = {[type]: state[type]};
      this.updateParams(newValueObj);
      return {
        queryValues: {
          ...state.queryValues,
          ...newValueObj,
        },
      };
    });
  };

  handleUpdateEnvironmments = () => this.handleUpdate('environment');

  handleUpdateProjects = () => this.handleUpdate('project');

  render() {
    const {organization, children} = this.props;
    const {period, start, end, utc} = this.state;

    const projects =
      organization.projects && organization.projects.filter(({isMember}) => isMember);

    return (
      <Feature features={['events-stream']} renderDisabled>
        <EventsContext.Provider
          value={{actions: this.actions, ...this.state.queryValues}}
        >
          <OrganizationEventsContent>
            <Header>
              <HeaderItemPosition>
                <MultipleProjectSelector
                  organization={organization}
                  projects={projects}
                  value={this.state.project}
                  onChange={this.handleChangeProjects}
                  onUpdate={this.handleUpdateProjects}
                />
              </HeaderItemPosition>
              <HeaderSeparator />
              <HeaderItemPosition>
                <MultipleEnvironmentSelector
                  organization={organization}
                  value={this.state.environment}
                  onChange={this.handleChangeEnvironments}
                  onUpdate={this.handleUpdateEnvironmments}
                />
              </HeaderItemPosition>
              <HeaderSeparator />
              <HeaderItemPosition>
                <TimeRangeSelector
                  showAbsolute
                  showRelative
                  relative={period}
                  start={start}
                  end={end}
                  utc={utc}
                  onChange={this.handleChangeTime}
                  onUpdate={this.handleUpdatePeriod}
                />
              </HeaderItemPosition>
              <HeaderSeparator />
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

const Body = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: ${space(3)} ${space(4)};
`;
