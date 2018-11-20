import {Flex} from 'grid-emotion';
import {isDate, isEqual, isEqualWith} from 'lodash';
import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {DEFAULT_STATS_PERIOD, DEFAULT_USE_UTC} from 'app/constants';
import {defined} from 'app/utils';
import {getLocalDateObject, getUtcDateString} from 'app/utils/dates';
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

import {getParams} from './utils/getParams';
import EventsContext from './utils/eventsContext';

// `lodash.isEqual` does not compare date objects properly?
const dateComparator = (value, other) => {
  if (isDate(value) && isDate(other)) {
    return +value === +other;
  }

  // returning undefined will use default comparator
  return undefined;
};

const isEqualWithDates = (a, b) => isEqualWith(a, b, dateComparator);
const isEqualWithEmptyArrays = (newQuery, current) => {
  // We will only get empty arrays from `newQuery`
  // Can't use isEqualWith because keys are unbalanced (guessing)
  return isEqual(
    Object.entries(newQuery)
      .filter(([, value]) => !Array.isArray(value) || !!value.length)
      .reduce(
        (acc, [key, value]) => ({
          ...acc,
          [key]: value,
        }),
        {}
      ),
    current
  );
};

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

      // params from URL will be a string
      utc: typeof query.utc !== 'undefined' ? query.utc === 'true' : DEFAULT_USE_UTC,
    };
  }

  static getDerivedStateFromProps(props, state) {
    const values = OrganizationEventsContainer.getStateFromRouter(props);

    // Update `queryValues` if URL parameters change
    if (!isEqualWithDates(state.queryValues, values)) {
      return {
        ...values,
        queryValues: values,
      };
    }

    return null;
  }

  constructor(props) {
    super(props);

    this.actions = {
      updateParams: this.updateParams,
    };
    this.state = {};
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

    // Only push new location if query params has changed because this will cause a heavy re-render
    if (isEqualWithEmptyArrays(newQuery, router.location.query)) {
      return;
    }

    router.push({
      pathname: router.location.pathname,
      query: newQuery,
    });
  };

  handleChangeProjects = projects => {
    this.setState({
      project: projects,
    });
  };

  handleChangeEnvironments = environments => {
    this.setState({
      environment: environments,
    });
  };

  handleChangeTime = ({start, end, relative, utc}) => {
    this.setState({start, end, period: relative, utc});
  };

  handleUpdatePeriod = () => {
    let {period, start, end, utc} = this.state;
    let newValueObj = {
      ...(defined(period) ? {period} : {start, end}),
      utc,
    };

    this.updateParams(newValueObj);
  };

  handleUpdate = type => {
    let newValueObj = {[type]: this.state[type]};
    this.updateParams(newValueObj);
  };

  handleUpdateEnvironmments = () => this.handleUpdate('environment');

  handleUpdateProjects = () => this.handleUpdate('project');

  render() {
    const {organization, children} = this.props;
    const {period, start, end, utc} = this.state;

    const projects =
      organization.projects && organization.projects.filter(({isMember}) => isMember);

    return (
      <Feature features={['global-views']} renderDisabled>
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
