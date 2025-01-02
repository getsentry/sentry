import {Fragment, useCallback} from 'react';
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
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {MRI} from 'sentry/types/metrics';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {getDefaultAggregation, getMetricsUrl} from 'sentry/utils/metrics';
import {getReadableMetricType} from 'sentry/utils/metrics/formatters';
import {formatMRI, formatMRIField, MRIToField, parseMRI} from 'sentry/utils/metrics/mri';
import {MetricDisplayType} from 'sentry/utils/metrics/types';
import {useBlockMetric} from 'sentry/utils/metrics/useBlockMetric';
import {useMetricsQuery} from 'sentry/utils/metrics/useMetricsQuery';
import {useMetricsTags} from 'sentry/utils/metrics/useMetricsTags';
import routeTitleGen from 'sentry/utils/routeTitle';
import {TextAlignRight} from 'sentry/views/insights/common/components/textAlign';
import {CodeLocations} from 'sentry/views/metrics/codeLocations';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {useAccess} from 'sentry/views/settings/projectMetrics/access';
import {BlockButton} from 'sentry/views/settings/projectMetrics/blockButton';

import {useProjectMetric} from '../../../utils/metrics/useMetricsMeta';

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
  const {hasAccess} = useAccess({access: ['project:write'], project});

  const {type, name, unit} = parseMRI(mri) ?? {};
  const aggregation = getDefaultAggregation(mri);
  const {data: metricsData, isPending} = useMetricsQuery(
    [{mri, aggregation, name: 'query'}],
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

  const field = MRIToField(mri, aggregation);
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
  const isChartEmpty = series[0]!.data.every(({value}) => value === 0);

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
              disabled={blockMetricMutation.isPending}
              isBlocked={isBlockedMetric}
              onConfirm={handleMetricBlockToggle}
              blockTarget="metric"
            />
            <LinkButton
              to={getMetricsUrl(organization.slug, {
                statsPeriod: '30d',
                project: [project.id],
                widgets: [
                  {
                    mri,
                    displayType: MetricDisplayType.BAR,
                    aggregation,
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
          {isPending && <Placeholder height="100px" />}
          {!isPending && (
            <MiniBarChart
              series={series}
              colors={CHART_PALETTE[0]}
              height={100}
              isGroupedByDate
              stacked
              labelYAxisExtents
            />
          )}
          {!isPending && isChartEmpty && (
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
        isLoading={isPending}
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
                  disabled={blockMetricMutation.isPending || isBlockedMetric}
                  isBlocked={isBlockedTag}
                  onConfirm={() => handleMetricTagBlockToggle(key)}
                  blockTarget="tag"
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
