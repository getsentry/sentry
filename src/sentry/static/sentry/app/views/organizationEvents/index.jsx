import {Flex} from 'grid-emotion';
import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import EventsContext from 'app/views/organizationEvents/eventsContext';
import Feature from 'app/components/feature';
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

  static getDerivedStateFromProps(props, state) {
    const {query} = props.router.location;

    return {
      projects: query.projects || [],
      environments: query.environments || [],
      period: query.period || '7d',
    };
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
    router.push({
      pathname: router.location.pathname,
      query: {
        ...router.location.query,
        ...obj,
      },
    });
  };

  handleChangeProjects = projects => {
    this.updateParams({projects});
  };

  handleChangeEnvironments = environments => {
    this.updateParams({environments});
  };

  handleChangeTime = period => {
    this.updateParams({period});
  };

  render() {
    let {organization, children} = this.props;

    let projects =
      organization.projects && organization.projects.filter(({isMember}) => isMember);

    return (
      <Feature feature={['events-stream']} renderNoFeatureMessage>
        <EventsContext.Provider value={{actions: this.actions, ...this.state}}>
          <Content>
            <Header>
              <MultipleProjectSelector
                organization={organization}
                anchorRight
                projects={projects}
                value={this.state.projects}
                onChange={this.handleChangeProjects}
              />
              <HeaderSeparator />
              <MultipleEnvironmentSelector
                organization={organization}
                value={this.state.environments}
                onChange={this.handleChangeEnvironments}
              />
              <HeaderSeparator />
              <TimeRangeSelector
                showAbsolute={false}
                showRelative
                relative={this.state.period}
                onChange={this.handleChangeTime}
              />
            </Header>
            <Body>{children}</Body>
          </Content>
        </EventsContext.Provider>
      </Feature>
    );
  }
}
export default withRouter(withOrganization(OrganizationEventsContainer));
export {OrganizationEventsContainer};

const Content = styled(Flex)`
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  margin-bottom: -20px; /* <footer> has margin-top: 20px; */
`;

const Header = styled(Flex)`
  border-bottom: 1px solid ${p => p.theme.borderLight};
  font-size: 18px;
  padding: ${space(1)} ${space(4)};
`;

const Body = styled('div')`
  flex: 1;
  padding: ${space(3)};
`;
