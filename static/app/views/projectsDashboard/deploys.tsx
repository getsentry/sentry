import {LinkButton} from '@sentry/scraps/button';
import {InfoText} from '@sentry/scraps/info';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TimeSince} from 'sentry/components/timeSince';
import {Version} from 'sentry/components/version';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import type {Deploy as DeployType} from 'sentry/types/release';

const DEPLOY_COUNT = 2;

const COLUMNS: TableColumnConfig[] = [
  {key: 'environment', width: 'minmax(30px, 1fr)'},
  {key: 'release', width: '1fr'},
  {key: 'time', width: '1fr'},
];

type Props = {
  project: Project;
  latestDeploys?: Project['latestDeploys'];
};

export function Deploys({latestDeploys, project}: Props) {
  const flattenedDeploys = Object.entries(latestDeploys ?? {}).map(
    ([environment, value]): Pick<
      DeployType,
      'version' | 'dateFinished' | 'environment'
    > => ({environment, ...value})
  );

  const deploys = flattenedDeploys
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
    <SimpleTable aria-label={t('Latest Deploys')} columns={COLUMNS} density="compressed">
      {deploys.map(deploy => (
        <SimpleTable.Row key={`${deploy.environment}-${deploy.version}`}>
          <SimpleTable.RowCell>
            <InfoText mode="overflowOnly" title={deploy.environment}>
              {deploy.environment}
            </InfoText>
          </SimpleTable.RowCell>
          <SimpleTable.RowCell>
            <Text ellipsis>
              <Version
                version={deploy.version}
                projectId={project.id}
                tooltipRawVersion
                truncate
              />
            </Text>
          </SimpleTable.RowCell>
          <SimpleTable.RowCell>
            <Text ellipsis variant="muted">
              <TimeSince date={deploy.dateFinished} unitStyle="short" />
            </Text>
          </SimpleTable.RowCell>
        </SimpleTable.Row>
      ))}
    </SimpleTable>
  );
}
