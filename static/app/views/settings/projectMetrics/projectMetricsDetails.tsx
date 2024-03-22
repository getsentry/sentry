import {Fragment, useCallback} from 'react';
import type {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import MiniBarChart from 'sentry/components/charts/miniBarChart';
import EmptyMessage from 'sentry/components/emptyMessage';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {PanelTable} from 'sentry/components/panels/panelTable';
import Placeholder from 'sentry/components/placeholder';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {
  MetricsOperation,
  MetricType,
  MRI,
  Organization,
  Project,
} from 'sentry/types';
import {getDdmUrl} from 'sentry/utils/metrics';
import {getReadableMetricType} from 'sentry/utils/metrics/formatters';
import {formatMRI, formatMRIField, MRIToField, parseMRI} from 'sentry/utils/metrics/mri';
import {MetricDisplayType} from 'sentry/utils/metrics/types';
import {useBlockMetric} from 'sentry/utils/metrics/useBlockMetric';
import {useMetricsQuery} from 'sentry/utils/metrics/useMetricsQuery';
import {useMetricsTags} from 'sentry/utils/metrics/useMetricsTags';
import routeTitleGen from 'sentry/utils/routeTitle';
import {CodeLocations} from 'sentry/views/ddm/codeLocations';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {useAccess} from 'sentry/views/settings/projectMetrics/access';
import {BlockButton} from 'sentry/views/settings/projectMetrics/blockButton';
import {TextAlignRight} from 'sentry/views/starfish/components/textAlign';

import {useProjectMetric} from '../../../utils/metrics/useMetricsMeta';

function getSettingsOperationForType(type: MetricType): MetricsOperation {
  switch (type) {
    case 'c':
      return 'sum';
    case 's':
      return 'count_unique';
    case 'd':
      return 'count';
    case 'g':
      return 'count';
    default:
      return 'sum';
  }
}

type Props = {
  organization: Organization;
  project: Project;
} & RouteComponentProps<{mri: MRI; projectId: string}, {}>;

function ProjectMetricsDetails({project, params, organization}: Props) {
  const {mri} = params;

  const projectId = parseInt(project.id, 10);
  const projectIds = [projectId];

  const {
    data: {blockingStatus},
  } = useProjectMetric(mri, projectId);
  const {data: tagsData = []} = useMetricsTags(mri, {projects: projectIds}, false);

  const isBlockedMetric = blockingStatus?.isBlocked ?? false;
  const blockMetricMutation = useBlockMetric(project);
  const {hasAccess} = useAccess({access: ['project:write']});

  const {type, name, unit} = parseMRI(mri) ?? {};
  const operation = getSettingsOperationForType(type ?? 'c');
  const {data: metricsData, isLoading} = useMetricsQuery(
    [{mri, op: operation, name: 'query'}],
    {
      datetime: {
        period: '30d',
        start: '',
        end: '',
        utc: false,
      },
      environments: [],
      projects: projectIds,
    },
    {interval: '1d'}
  );

  const field = MRIToField(mri, operation);
  const series = [
    {
      seriesName: formatMRIField(field) ?? 'Metric',
      data:
        metricsData?.intervals.map((interval, index) => ({
          name: interval,
          value: metricsData.data[0]?.[0]?.series[index] ?? 0,
        })) ?? [],
    },
  ];
  const isChartEmpty = series[0].data.every(({value}) => value === 0);

  const handleMetricBlockToggle = useCallback(() => {
    const operationType = isBlockedMetric ? 'unblockMetric' : 'blockMetric';
    blockMetricMutation.mutate({operationType, mri});
  }, [blockMetricMutation, mri, isBlockedMetric]);

  const handleMetricTagBlockToggle = useCallback(
    (tag: string) => {
      const currentlyBlockedTags = blockingStatus?.blockedTags ?? [];
      const isBlockedTag = currentlyBlockedTags.includes(tag);

      const operationType = isBlockedTag ? 'unblockTags' : 'blockTags';

      blockMetricMutation.mutate({operationType, mri, tags: [tag]});
    },
    [blockMetricMutation, mri, blockingStatus?.blockedTags]
  );

  const tags = tagsData.sort((a, b) => a.key.localeCompare(b.key));

  return (
    <Fragment>
      <SentryDocumentTitle title={routeTitleGen(formatMRI(mri), project.slug, false)} />
      <SettingsPageHeader
        title={t('Metric Details')}
        action={
          <Controls>
            <BlockButton
              size="sm"
              hasAccess={hasAccess}
              disabled={blockMetricMutation.isLoading}
              isBlocked={isBlockedMetric}
              onConfirm={handleMetricBlockToggle}
              aria-label={t('Block Metric')}
            />
            <LinkButton
              to={getDdmUrl(organization.slug, {
                statsPeriod: '30d',
                project: [project.id],
                widgets: [
                  {
                    mri,
                    displayType: MetricDisplayType.BAR,
                    op: operation,
                    query: '',
                    groupBy: undefined,
                  },
                ],
              })}
              size="sm"
            >
              {t('Open in Metrics')}
            </LinkButton>
          </Controls>
        }
      />

      <Panel>
        <PanelHeader>
          <Title>{t('Metric Details')}</Title>
        </PanelHeader>

        <PanelBody>
          <FieldGroup
            label={t('Name')}
            help={t('Name of the metric (invoked in your code).')}
          >
            <MetricName>
              <strong>{name}</strong>
            </MetricName>
          </FieldGroup>
          <FieldGroup
            label={t('Type')}
            help={t('Either counter, distribution, gauge, or set.')}
          >
            <div>{getReadableMetricType(type)}</div>
          </FieldGroup>
          <FieldGroup
            label={t('Unit')}
            help={t('Unit specified in the code - affects formatting.')}
          >
            <div>{unit}</div>
          </FieldGroup>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>{t('Activity in the last 30 days (by day)')}</PanelHeader>

        <PanelBody withPadding>
          {isLoading && <Placeholder height="100px" />}
          {!isLoading && (
            <MiniBarChart
              series={series}
              colors={CHART_PALETTE[0]}
              height={100}
              isGroupedByDate
              stacked
              labelYAxisExtents
            />
          )}
          {!isLoading && isChartEmpty && (
            <EmptyMessage
              title={t('No activity.')}
              description={t("We don't have data for this metric in the last 30 days.")}
            />
          )}
        </PanelBody>
      </Panel>

      <PanelTable
        headers={[
          <TableHeading key="tags"> {t('Tags')}</TableHeading>,
          <TextAlignRight key="actions">
            <TableHeading> {t('Actions')}</TableHeading>
          </TextAlignRight>,
        ]}
        emptyMessage={t('There are no tags for this metric.')}
        isEmpty={tags.length === 0}
        isLoading={isLoading}
      >
        {tags.map(({key}) => {
          const isBlockedTag = blockingStatus?.blockedTags?.includes(key) ?? false;
          return (
            <Fragment key={key}>
              <div>{key}</div>
              <TextAlignRight>
                <BlockButton
                  size="xs"
                  hasAccess={hasAccess}
                  disabled={blockMetricMutation.isLoading || isBlockedMetric}
                  isBlocked={isBlockedTag}
                  onConfirm={() => handleMetricTagBlockToggle(key)}
                  aria-label={t('Block tag')}
                  message={
                    isBlockedTag
                      ? t('Are you sure you want to unblock this tag?')
                      : t(
                          'Are you sure you want to block this tag? It will no longer be ingested, and will not be available for use in Metrics, Alerts, or Dashboards.'
                        )
                  }
                />
              </TextAlignRight>
            </Fragment>
          );
        })}
      </PanelTable>

      <Panel>
        <PanelHeader>{t('Code Location')}</PanelHeader>
        <PanelBody withPadding>
          <CodeLocations mri={mri} />
        </PanelBody>
      </Panel>
    </Fragment>
  );
}

const TableHeading = styled('div')`
  color: ${p => p.theme.textColor};
`;

const MetricName = styled('div')`
  word-break: break-word;
`;

const Title = styled('div')`
  flex: 1;
  margin-right: ${space(1)};
`;

const Controls = styled('div')`
  display: grid;
  align-items: center;
  gap: ${space(1)};
  grid-auto-flow: column;
`;

export default ProjectMetricsDetails;
