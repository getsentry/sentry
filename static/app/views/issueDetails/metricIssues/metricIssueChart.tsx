import {Container, Flex} from '@sentry/scraps/layout';

import {AreaChart} from 'sentry/components/charts/areaChart';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {Group, GroupOpenPeriod} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import type {MetricDetector} from 'sentry/types/workflowEngine/detectors';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useMetricDetectorChart} from 'sentry/views/detectors/components/details/metric/chart';
import {useDetectorQuery} from 'sentry/views/detectors/hooks';
import {useOpenPeriods} from 'sentry/views/detectors/hooks/useOpenPeriods';
import {useIssueDetails} from 'sentry/views/issueDetails/streamline/context';
import {GraphAlert} from 'sentry/views/issueDetails/streamline/eventGraph';

interface MetricIssueChartProps {
  group: Group;
  project: Project;
}

const CHART_HEIGHT = 180;

export function MetricIssueChart({group, project: _project}: MetricIssueChartProps) {
  const {detectorDetails} = useIssueDetails();
  const detectorId = detectorDetails?.detectorId;

  const {
    data: detector,
    isPending: isDetectorLoading,
    isError: isDetectorError,
    error: detectorError,
  } = useDetectorQuery<MetricDetector>(detectorId ?? '', {
    enabled: !!detectorId && detectorDetails?.detectorType === 'metric_alert',
    retry: false,
  });
  const {data: openPeriods = []} = useOpenPeriods({groupId: group.id});

  if (isDetectorError) {
    const errorMessage = detectorError?.message ?? t('Unknown error');
    return (
      <Container width="100%">
        <GraphAlert type="error">
          {t('Error loading metric monitor: %s', errorMessage)}
        </GraphAlert>
      </Container>
    );
  }

  if (isDetectorLoading) {
    return <MetricIssueChartPlaceholder />;
  }

  return <MetricIssueChartContent detector={detector} openPeriods={openPeriods} />;
}

function MetricIssueChartContent({
  detector,
  openPeriods,
}: {
  detector: MetricDetector;
  openPeriods: GroupOpenPeriod[];
}) {
  const {selection} = usePageFilters();

  const {
    chartProps,
    isLoading,
    error: chartError,
  } = useMetricDetectorChart({
    detector,
    openPeriods,
    height: CHART_HEIGHT,
    ...normalizeDateTimeParams(selection.datetime),
  });

  if (isLoading) {
    return <MetricIssueChartPlaceholder />;
  }

  if (chartError) {
    return (
      <Container width="100%">
        <GraphAlert type="error">
          {t('Error loading metric monitor: %s', chartError?.message)}
        </GraphAlert>
      </Container>
    );
  }

  return (
    <MetricChartSection>
      <AreaChart {...chartProps} />
    </MetricChartSection>
  );
}

function MetricIssueChartPlaceholder() {
  return (
    <MetricChartSection>
      <Flex align="center" justify="center" padding="md 0" height={`${CHART_HEIGHT}px`}>
        <Placeholder height="100%" />
      </Flex>
    </MetricChartSection>
  );
}

function MetricChartSection({children}: {children: React.ReactNode}) {
  return (
    <Container width="100%" padding="0 lg sm lg">
      {children}
    </Container>
  );
}
