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

    this.state = {
      actions: {
        updateParams: this.updateParams,
        setSpecifier: this.setSpecifier,
      },
      projects: [],
      environments: [],
      period: '7d',
      specifiers: [],
    };
  }

  updateParams = obj => {
    this.setState(state => ({
      ...state,
      ...obj,
    }));
  };

  setSpecifier = (tag, value) => {
    this.setState(state => ({
      ...state,
      specifiers: [`${tag}:${value}`],
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
    let projects =
      organization.projects && organization.projects.filter(({isMember}) => isMember);

    return (
      <Feature feature={['health']} renderNoFeatureMessage>
        <HealthContext.Provider value={this.state}>
          <HealthWrapper>
            <HealthNavigationMenu />
            <Content>
              <Header>
                <MultipleProjectSelector
                  anchorRight={false}
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
