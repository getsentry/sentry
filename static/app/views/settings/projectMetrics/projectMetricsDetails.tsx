import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import MiniBarChart from 'sentry/components/charts/miniBarChart';
import EmptyMessage from 'sentry/components/emptyMessage';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelTable from 'sentry/components/panels/panelTable';
import Placeholder from 'sentry/components/placeholder';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {t} from 'sentry/locale';
import {MetricsOperation, MetricType, MRI, Organization, Project} from 'sentry/types';
import {getDdmUrl, getReadableMetricType, MetricDisplayType} from 'sentry/utils/metrics';
import {formatMRI, formatMRIField, MRIToField, parseMRI} from 'sentry/utils/metrics/mri';
import {useMetricsData} from 'sentry/utils/metrics/useMetricsData';
import {useMetricsTags} from 'sentry/utils/metrics/useMetricsTags';
import routeTitleGen from 'sentry/utils/routeTitle';
import {CodeLocations} from 'sentry/views/ddm/codeLocations';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

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
  const {type, name, unit} = parseMRI(mri) ?? {};
  const operation = getSettingsOperationForType(type ?? 'c');
  const field = MRIToField(mri, operation);
  const {data: tagsData = []} = useMetricsTags(mri, [parseInt(project.id, 10)]);
  const {data: metricsData, isLoading} = useMetricsData(
    {
      datetime: {
        period: '30d',
        start: '',
        end: '',
        utc: false,
      },
      environments: [],
      mri,
      projects: [parseInt(project.id, 10)],
      op: operation,
    },
    {interval: '1d'}
  );

  const series = [
    {
      seriesName: formatMRIField(field) ?? 'Metric',
      data:
        metricsData?.intervals.map((interval, index) => ({
          name: interval,
          value: metricsData.groups[0].series[field][index] ?? 0,
        })) ?? [],
    },
  ];
  const isChartEmpty = series[0].data.every(({value}) => value === 0);

  const tags = tagsData.sort((a, b) => a.key.localeCompare(b.key));

  return (
    <Fragment>
      <SentryDocumentTitle title={routeTitleGen(formatMRI(mri), project.slug, false)} />
      <SettingsPageHeader
        title={t('Metric Details')}
        action={
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
            {t('Open in DDM')}
          </LinkButton>
        }
      />

      <Panel>
        <PanelHeader>{t('Metric Details')}</PanelHeader>

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
        headers={[<TableHeading key="tags"> {t('Tags')}</TableHeading>]}
        emptyMessage={t('There are no tags for this metric.')}
        isEmpty={tags.length === 0}
        isLoading={isLoading}
      >
        {tags.map(({key}) => (
          <div key={key}>{key}</div>
        ))}
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

export default ProjectMetricsDetails;
