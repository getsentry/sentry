import {Flex} from '@sentry/scraps/layout';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {DetailLayout} from 'sentry/components/workflowEngine/layout/detail';
import type {Project} from 'sentry/types/project';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {
  DisableDetectorAction,
  EditDetectorAction,
} from 'sentry/views/detectors/components/details/common/actions';
import {DetectorDetailsAssignee} from 'sentry/views/detectors/components/details/common/assignee';
import {DetectorDetailsAutomations} from 'sentry/views/detectors/components/details/common/automations';
import {DetectorExtraDetails} from 'sentry/views/detectors/components/details/common/extraDetails';
import {DetectorDetailsHeader} from 'sentry/views/detectors/components/details/common/header';
import {DetectorDetailsOpenPeriodIssues} from 'sentry/views/detectors/components/details/common/openPeriodIssues';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

type FallbackDetectorDetailsProps = {
  detector: Detector;
  project: Project;
};

export function FallbackDetectorDetails({
  detector,
  project,
}: FallbackDetectorDetailsProps) {
  const hasPageFrameFeature = useHasPageFrameFeature();

  return (
    <DetailLayout>
      <DetectorDetailsHeader
        detector={detector}
        project={project}
        useLocalDetailActions={hasPageFrameFeature}
      />
      <DetailLayout.Body>
        <DetailLayout.Main>
          {hasPageFrameFeature ? (
            <Flex align="center" justify="between" gap="md">
              <DatePageFilter />
              <Flex flex={1} justify="end" gap="md">
                <DisableDetectorAction detector={detector} />
                <EditDetectorAction detector={detector} />
              </Flex>
            </Flex>
          ) : null}
          <ErrorBoundary mini>
            <DetectorDetailsOpenPeriodIssues detector={detector} />
          </ErrorBoundary>
          <DetectorDetailsAutomations detector={detector} />
        </DetailLayout.Main>
        <DetailLayout.Sidebar>
          <DetectorDetailsAssignee owner={detector.owner} />
          <DetectorExtraDetails>
            <DetectorExtraDetails.DateCreated detector={detector} />
            <DetectorExtraDetails.CreatedBy detector={detector} />
            <DetectorExtraDetails.LastModified detector={detector} />
            <DetectorExtraDetails.Environment detector={detector} />
          </DetectorExtraDetails>
        </DetailLayout.Sidebar>
      </DetailLayout.Body>
    </DetailLayout>
  );
}
