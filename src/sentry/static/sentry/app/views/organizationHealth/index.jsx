import {Flex} from 'grid-emotion';
import React from 'react';
import styled from 'react-emotion';

import Feature from 'app/components/feature';
import HeaderSeparator from 'app/components/organizations/headerSeparator';
import MultipleEnvironmentSelector from 'app/components/organizations/multipleEnvironmentSelector';
import MultipleProjectSelector from 'app/components/organizations/multipleProjectSelector';
import SentryTypes from 'app/sentryTypes';
import TimeRangeSelector from 'app/components/organizations/timeRangeSelector';
import space from 'app/styles/space';
import withLatestContext from 'app/utils/withLatestContext';

import HealthContext from './util/healthContext';
import HealthNavigationMenu from './healthNavigationMenu';

class OrganizationHealth extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
  };

  constructor(props) {
    super(props);
    let {organization} = props;
    let projects = organization.projects
      .filter(({isMember}) => isMember)
      .map(({id}) => id);
    this.state = {
      params: {
        projects,
        environments: [],
        period: '7d',
      },
    };
  }

  updateParams = obj => {
    this.setState(state => ({
      ...state,
      params: {
        ...state.params,
        ...obj,
      },
    }));
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

    // TODO(billy): Is this what we want, only projects user is member of?
    let projects = organization.projects.filter(({isMember}) => isMember);

    return (
      <Feature feature={['health']} renderNoFeatureMessage>
        <HealthContext.Provider value={this.state.params}>
          <HealthWrapper>
            <HealthNavigationMenu />
            <Content>
              <Header>
                <MultipleProjectSelector
                  projects={projects}
                  value={this.state.params.projects}
                  onChange={this.handleChangeProjects}
                />
                <HeaderSeparator />
                <MultipleEnvironmentSelector
                  organization={organization}
                  value={this.state.params.environments}
                  onChange={this.handleChangeEnvironments}
                />
                <HeaderSeparator />
                <TimeRangeSelector
                  absolute={false}
                  relative
                  value={this.state.params.period}
                  onChange={this.handleChangeTime}
                />
              </Header>
              <Body>{children}</Body>
            </Content>
          </HealthWrapper>
        </HealthContext.Provider>
      </Feature>
    );
  }
}

export default withLatestContext(OrganizationHealth);
export {OrganizationHealth};

const HealthWrapper = styled(Flex)`
  flex: 1;
  margin-bottom: -20px; /* <footer> has margin-top: 20px; */
`;
const Content = styled(Flex)`
  flex-direction: column;
  flex: 1;
  overflow: hidden;
`;

const Header = styled(Flex)`
  border-bottom: 1px solid ${p => p.theme.borderLight};
  font-size: 18px;
`;

const Body = styled('div')`
  flex: 1;
  padding: ${space(3)};
`;
