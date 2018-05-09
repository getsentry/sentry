import React from 'react';
import {Flex} from 'grid-emotion';
import styled from 'react-emotion';

import {t} from 'app/locale';
import Button from 'app/components/buttons/button';
import Tooltip from 'app/components/tooltip';
import SentryTypes from 'app/proptypes';
import img from '../../../images/dashboard/hair-on-fire.svg';

export default class EmptyState extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
  };

  render() {
    const {organization} = this.props;
    const orgId = organization.slug;
    const canCreateProject = organization.access.includes('project:write');
    const canJoinTeam = organization.access.includes('team:read');

    return (
      <Flex flex="1" align="center" justify="center">
        <Wrapper>
          <img src={img} height={350} alt="Nothing to see" />
          <Content direction="column" justify="center">
            <h2>{t('Remain calm.')}</h2>
            <p>{t("Sentry's got you covered. To get started:")}</p>
            <Flex align="center">
              <CallToAction>
                <Tooltip
                  disabled={canJoinTeam}
                  title={t('You do not have permission to join a team.')}
                >
                  <Button
                    disabled={!canJoinTeam}
                    priority="primary"
                    to={`/settings/${orgId}/teams/`}
                  >
                    {t('Join a Team')}
                  </Button>
                </Tooltip>
              </CallToAction>

              <CallToAction>
                <Tooltip
                  disabled={canCreateProject}
                  title={t('You do not have permission to create a project.')}
                >
                  <Button
                    disabled={!canCreateProject}
                    to={`/organizations/${orgId}/projects/new/`}
                  >
                    {t('Create project')}
                  </Button>
                </Tooltip>
              </CallToAction>
            </Flex>
          </Content>
        </Wrapper>
      </Flex>
    );
  }
}

const CallToAction = styled('div')`
  margin-right: 8px;
  &:last-child {
    margin-right: 0;
  }
`;

const Wrapper = styled(Flex)`
  height: 350px;
`;

const Content = styled(Flex)`
  margin-left: 40px;
`;
