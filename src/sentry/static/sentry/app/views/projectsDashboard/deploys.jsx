import {Flex, Box} from 'grid-emotion';
import React from 'react';
import moment from 'moment-timezone';
import styled from 'react-emotion';

import {t} from 'app/locale';
import Button from 'app/components/button';
import Link from 'app/components/links/link';
import SentryTypes from 'app/sentryTypes';
import TextOverflow from 'app/components/textOverflow';
import getDynamicText from 'app/utils/getDynamicText';

const DEPLOY_COUNT = 2;

export default class Deploys extends React.Component {
  static propTypes = {
    project: SentryTypes.Project.isRequired,
    organization: SentryTypes.Organization.isRequired,
  };

  render() {
    const {project, organization} = this.props;

    const flattenedDeploys = Object.entries(project.latestDeploys || {}).map(
      ([environment, value]) => {
        return {environment, ...value};
      }
    );

    const deploys = (flattenedDeploys || [])
      .sort((a, b) => new Date(b.dateFinished) - new Date(a.dateFinished))
      .slice(0, DEPLOY_COUNT);

    if (deploys.length) {
      return (
        <DeployBox p={2} pt={1}>
          {deploys.map(deploy => (
            <Deploy
              key={`${deploy.environment}-${deploy.version}`}
              deploy={deploy}
              project={project}
              organization={organization}
            />
          ))}
        </DeployBox>
      );
    } else {
      return <NoDeploys />;
    }
  }
}

class Deploy extends React.Component {
  static propTypes = {
    deploy: SentryTypes.Deploy.isRequired,
    project: SentryTypes.Project.isRequired,
    organization: SentryTypes.Organization.isRequired,
  };

  render() {
    const {deploy, organization, project} = this.props;

    return (
      <DeployRow justify="space-between">
        <Environment>{deploy.environment}</Environment>
        <Version>
          <StyledLink
            to={`/organizations/${organization.slug}/releases/${
              deploy.version
            }/?project=${project.id}`}
          >
            {deploy.version}
          </StyledLink>
        </Version>
        <Flex w={90} justify="flex-end">
          <DeployTimeWrapper>
            {getDynamicText({
              value: moment(deploy.dateFinished).fromNow(),
              fixed: '3 hours ago',
            })}
          </DeployTimeWrapper>
        </Flex>
      </DeployRow>
    );
  }
}

const DeployRow = styled(Flex)`
  color: ${p => p.theme.gray2};
  font-size: 12px;
  margin-top: 8px;
`;

const Environment = styled(TextOverflow)`
  font-size: 11px;
  text-transform: uppercase;
  width: 80px;
  border: 1px solid ${p => p.theme.offWhite2};
  margin-right: 8px;
  background-color: ${p => p.theme.offWhite};
  text-align: center;
  border-radius: ${p => p.theme.borderRadius};
`;

const Version = styled(TextOverflow)`
  display: flex;
  flex: 1;
  margin-right: 8px;
`;

const StyledLink = styled(Link)`
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
`;

const DeployTimeWrapper = styled('div')`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

class NoDeploys extends React.Component {
  render() {
    return (
      <DeployBox p={2}>
        <Background align="center" justify="center">
          <Button size="xsmall" href="https://docs.sentry.io/learn/releases/" external>
            {t('Track deploys')}
          </Button>
        </Background>
      </DeployBox>
    );
  }
}

const DeployBox = styled(Box)`
  height: 92px;
`;

const Background = styled(Flex)`
  height: 100%;
  background-color: ${p => p.theme.offWhite};
`;
