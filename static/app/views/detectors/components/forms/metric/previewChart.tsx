import {useMemo} from 'react';
import styled from '@emotion/styled';

import {AreaChart} from 'sentry/components/charts/areaChart';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import {Flex} from 'sentry/components/core/layout';
import Placeholder from 'sentry/components/placeholder';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {
  METRIC_DETECTOR_FORM_FIELDS,
  useMetricDetectorFormField,
} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';
import {DETECTOR_DATASET_TO_DISCOVER_DATASET_MAP} from 'sentry/views/detectors/datasetConfig/utils/discoverDatasetMap';

const CHART_HEIGHT = 175;

export function MetricDetectorPreviewChart() {
  const organization = useOrganization();
  const dataset = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.dataset);
  const aggregate = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.aggregateFunction
  );
  const interval = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.interval);
  const query = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.query);
  const environment = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.environment);
  const projectId = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.projectId);

  const datasetConfig = useMemo(() => getDatasetConfig(dataset), [dataset]);
  const seriesQueryOptions = datasetConfig.getSeriesQueryOptions({
    organization,
    aggregate,
    interval,
    query,
    environment,
    projectId: Number(projectId),
    dataset: DETECTOR_DATASET_TO_DISCOVER_DATASET_MAP[dataset],
  });

  const {data, isPending, isError} = useApiQuery<
    Parameters<typeof datasetConfig.transformSeriesQueryData>[0]
  >(seriesQueryOptions, {
    // 5 minutes
    staleTime: 5 * 60 * 1000,
  });

  const series = useMemo(() => {
    // TypeScript can't infer that each dataset config expects its own specific response type
    return datasetConfig.transformSeriesQueryData(data as any, aggregate);
  }, [datasetConfig, data, aggregate]);

  if (isPending) {
    return (
      <PreviewChartContainer>
        <Placeholder height={`${CHART_HEIGHT}px`} />
      </PreviewChartContainer>
    );
  }

  if (isError) {
    return (
      <PreviewChartContainer>
        <Flex style={{height: CHART_HEIGHT}} justify="center" align="center">
          <ErrorPanel>
            <IconWarning color="gray300" size="lg" />
            <div>{t('Error loading chart data')}</div>
          </ErrorPanel>
        </Flex>
      </PreviewChartContainer>
    );
  }

  return (
    <PreviewChartContainer>
      <AreaChart
        series={series}
        height={CHART_HEIGHT}
        stacked={false}
        isGroupedByDate
        showTimeInTooltip
      />
    </PreviewChartContainer>
  );
}

const PreviewChartContainer = styled('div')`
  max-width: 1440px;
  border-top: 1px solid ${p => p.theme.border};
`;
