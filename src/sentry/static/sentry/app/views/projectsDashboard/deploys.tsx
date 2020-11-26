import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import TimeSince from 'app/components/timeSince';
import Version from 'app/components/version';
import {IconReleases} from 'app/icons';
import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Deploy as DeployType, Project} from 'app/types';
import getDynamicText from 'app/utils/getDynamicText';

const DEPLOY_COUNT = 2;

type Props = {
  project: Project;
};

const Deploys = ({project}: Props) => {
  const flattenedDeploys = Object.entries(project.latestDeploys || {}).map(
    ([environment, value]): Pick<
      DeployType,
      'version' | 'dateFinished' | 'environment'
    > => ({environment, ...value})
  );

  const deploys = (flattenedDeploys || [])
    .sort(
      (a, b) => new Date(b.dateFinished).getTime() - new Date(a.dateFinished).getTime()
    )
    .slice(0, DEPLOY_COUNT);

  if (!deploys.length) {
    return <NoDeploys />;
  }

  return (
    <DeployContainer>
      {deploys.map(deploy => (
        <Deploy
          key={`${deploy.environment}-${deploy.version}`}
          deploy={deploy}
          project={project}
        />
      ))}
    </DeployContainer>
  );
};

Deploys.propTypes = {
  project: SentryTypes.Project.isRequired,
};

export default Deploys;

type DeployProps = Props & {
  deploy: Pick<DeployType, 'version' | 'dateFinished' | 'environment'>;
};

const Deploy = ({deploy, project}: DeployProps) => (
  <React.Fragment>
    <DeployItem>
      <StyledIconReleases size="sm" />
      <div>
        <Environment>{deploy.environment}</Environment>
        <Version
          version={deploy.version}
          projectId={project.id}
          tooltipRawVersion
          truncate
        />
      </div>
      <DeployTime>
        {getDynamicText({
          fixed: '3 hours ago',
          value: <TimeSince date={deploy.dateFinished} />,
        })}
      </DeployTime>
    </DeployItem>
  </React.Fragment>
);

Deploy.propTypes = {
  deploy: SentryTypes.Deploy.isRequired,
  project: SentryTypes.Project.isRequired,
};

const NoDeploys = () => (
  <DeployContainer>
    <Button size="small" href="https://docs.sentry.io/learn/releases/" external>
      {t('Track deploys')}
    </Button>
  </DeployContainer>
);

const DeployContainer = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${space(1.5)} ${space(2)};
  font-size: ${p => p.theme.fontSizeMedium};
  min-height: 108px;
`;

const StyledIconReleases = styled(IconReleases)`
  margin-top: ${space(0.5)};
`;

const DeployItem = styled('div')`
  display: grid;
  grid-template-columns: 26px 1fr 1fr;
  width: 100%;
`;

const Environment = styled('div')`
  ${overflowEllipsis};
`;

const DeployTime = styled('div')`
  color: ${p => p.theme.gray300};
  text-align: right;
  ${overflowEllipsis};
`;
