import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {Flex, Box} from 'grid-emotion';
import moment from 'moment-timezone';

import SentryTypes from 'app/proptypes';
import Button from 'app/components/buttons/button';
import Link from 'app/components/link';
import {t} from 'app/locale';
import TextOverflow from 'app/components/textOverflow';

const DEPLOY_COUNT = 2;

export default class Deploys extends React.Component {
  static propTypes = {
    project: SentryTypes.Project,
    orgId: PropTypes.string,
  };

  render() {
    const {project, orgId} = this.props;

    const projectId = project.slug;

    const flattenedDeploys = Object.entries(
      project.latestDeploys || {}
    ).map(([environment, value]) => {
      return {environment, ...value};
    });

    const deploys = (flattenedDeploys || [])
      .sort((a, b) => new Date(b.dateFinished) - new Date(a.dateFinished))
      .slice(0, DEPLOY_COUNT);

    if (deploys.length) {
      return (
        <DeployBox p={2} pb={0}>
          <Heading>{t('Latest deploys')}</Heading>
          <div>
            {deploys.map(deploy => (
              <Deploy
                key={deploy.version}
                deploy={deploy}
                projectId={projectId}
                orgId={orgId}
              />
            ))}
          </div>
        </DeployBox>
      );
    } else {
      return <NoDeploys />;
    }
  }
}

const Heading = styled.div`
  color: ${p => p.theme.gray2};
  text-transform: uppercase;
  font-size: 14px;
`;

class Deploy extends React.Component {
  static propTypes = {
    deploy: SentryTypes.Deploy.isRequired,
    projectId: PropTypes.string.isRequired,
    orgId: PropTypes.string.isRequired,
  };

  render() {
    const {deploy, orgId, projectId} = this.props;
    return (
      <DeployRow justify="space-between">
        <Environment>{deploy.environment}</Environment>
        <Version>
          <StyledLink to={`/${orgId}/${projectId}/releases/${deploy.version}/`}>
            {deploy.version}
          </StyledLink>
        </Version>
        <Box w={80}>{moment(deploy.dateFinished).fromNow()}</Box>
      </DeployRow>
    );
  }
}

const DeployRow = styled(Flex)`
  color: ${p => p.theme.gray2};
  font-size: 13px;
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

class NoDeploys extends React.Component {
  render() {
    return (
      <DeployBox p={2} pb={0}>
        <Background align="center" justify="center">
          <Button
            size="xsmall"
            href="https://blog.sentry.io/2017/05/09/release-deploys"
            target="_blank"
          >
            {t('Track deploys')}
          </Button>
        </Background>
      </DeployBox>
    );
  }
}

const DeployBox = styled(Box)`
  height: 108px;
`;

const Background = styled(Flex)`
  height: 100%;
  background-color: ${p => p.theme.offWhite};
`;
