import {CompactSelect} from 'sentry/components/core/compactSelect';
import DetailLayout from 'sentry/components/workflowEngine/layout/detail';
import type {Project} from 'sentry/types/project';
import type {MetricDetector} from 'sentry/types/workflowEngine/detectors';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {DetectorDetailsAutomations} from 'sentry/views/detectors/components/details/common/automations';
import {DetectorDetailsHeader} from 'sentry/views/detectors/components/details/common/header';
import {DetectorDetailsOngoingIssues} from 'sentry/views/detectors/components/details/common/ongoingIssues';
import {MetricDetectorDetailsChart} from 'sentry/views/detectors/components/details/metric/chart';
import {MetricDetectorDetailsSidebar} from 'sentry/views/detectors/components/details/metric/sidebar';
import {useTimePeriodSelection} from 'sentry/views/detectors/hooks/useTimePeriodSelection';

type MetricDetectorDetailsProps = {
  detector: MetricDetector;
  project: Project;
};

export function MetricDetectorDetails({detector, project}: MetricDetectorDetailsProps) {
  const dataSource = detector.dataSources[0];
  const snubaQuery = dataSource.queryObj?.snubaQuery;

  const {selectedTimePeriod, setSelectedTimePeriod, timePeriodOptions} =
    useTimePeriodSelection({
      dataset: snubaQuery?.dataset ?? Dataset.ERRORS,
      interval: snubaQuery?.timeWindow,
    });

  return (
    <DetailLayout>
      <DetectorDetailsHeader detector={detector} project={project} />
      <DetailLayout.Body>
        <DetailLayout.Main>
          <CompactSelect
            size="sm"
            options={timePeriodOptions}
            value={selectedTimePeriod}
            onChange={opt => setSelectedTimePeriod(opt.value)}
          />
          <MetricDetectorDetailsChart
            detector={detector}
            statsPeriod={selectedTimePeriod}
          />
          <DetectorDetailsOngoingIssues
            detectorId={detector.id}
            query={{statsPeriod: selectedTimePeriod}}
          />
          <DetectorDetailsAutomations detector={detector} />
        </DetailLayout.Main>
        <DetailLayout.Sidebar>
          <MetricDetectorDetailsSidebar detector={detector} />
        </DetailLayout.Sidebar>
      </DetailLayout.Body>
    </DetailLayout>
  );
}
