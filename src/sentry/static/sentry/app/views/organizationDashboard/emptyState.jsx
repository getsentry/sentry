import React from 'react';
import PropTypes from 'prop-types';
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
    projects: PropTypes.arrayOf(SentryTypes.Project),
  };

  render() {
    const {organization, projects} = this.props;
    const orgId = organization.slug;
    const canCreateProject = organization.access.includes('project:write');
    const canJoinTeam = organization.access.includes('team:read');
    const hasProjects = !!projects.length;

    return (
      <Flex flex="1" align="center" justify="center">
        <Wrapper>
          <img src={img} height={350} alt="Nothing to see" />
          <Content direction="column" justify="center">
            <h2>{t('Remain calm.')}</h2>
            <p>{t("Sentry's got you covered.")}</p>
            {!hasProjects && (
              <CallToAction>
                <Tooltip
                  disabled={canCreateProject}
                  title={t('You do not have permission to create a project.')}
                >
                  <Button
                    disabled={!canCreateProject}
                    priority="primary"
                    to={`/organizations/${orgId}/projects/new/`}
                  >
                    {t('Create project')}
                  </Button>
                </Tooltip>
              </CallToAction>
            )}

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
          </Content>
        </Wrapper>
      </Flex>
    );
  }
}

const CallToAction = styled('div')`
  margin-bottom: 24px;
  &:last-child {
    margin-bottom: 0;
  }
`;

const Wrapper = styled(Flex)`
  height: 350px;
`;

const Content = styled(Flex)`
  margin-left: 40px;
`;
