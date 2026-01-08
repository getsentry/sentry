import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Tooltip} from 'sentry/components/core/tooltip';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import Version from 'sentry/components/version';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import type {Deploy as DeployType} from 'sentry/types/release';

const DEPLOY_COUNT = 2;

type Props = {
  project: Project;
};

export function Deploys({project}: Props) {
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
    return (
      <LinkButton size="sm" href="https://docs.sentry.io/product/releases/" external>
        {t('Track Deploys')}
      </LinkButton>
    );
  }

  return (
    <DeployRows>
      {deploys.map(deploy => (
        <Deploy
          key={`${deploy.environment}-${deploy.version}`}
          deploy={deploy}
          project={project}
        />
      ))}
    </DeployRows>
  );
}

type DeployProps = Props & {
  deploy: Pick<DeployType, 'version' | 'dateFinished' | 'environment'>;
};

function Deploy({deploy, project}: DeployProps) {
  return (
    <DeployRow>
      <Tooltip showOnlyOnOverflow title={deploy.environment}>
        <TextOverflow>{deploy.environment}</TextOverflow>
      </Tooltip>
      <TextOverflow>
        <Version
          version={deploy.version}
          projectId={project.id}
          tooltipRawVersion
          truncate
        />
      </TextOverflow>

      <DeployTime>
        <TimeSince date={deploy.dateFinished} unitStyle="short" />
      </DeployTime>
    </DeployRow>
  );
}

const DeployRow = styled('div')`
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
`;

const DeployRows = styled('div')`
  display: grid;
  grid-template-columns: minmax(30px, 1fr) 1fr 1fr;
  grid-template-rows: auto;
  gap: ${space(0.5)} ${space(1)};
  font-size: ${p => p.theme.fontSize.md};
  line-height: 1.2;
`;

const DeployTime = styled('div')`
  color: ${p => p.theme.subText};
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
