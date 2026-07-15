import {Flex} from '@sentry/scraps/layout';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {DetailLayout} from 'sentry/components/workflowEngine/layout/detail';
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

type FallbackDetectorDetailsProps = {
  detector: Detector;
};

export function FallbackDetectorDetails({detector}: FallbackDetectorDetailsProps) {
  return (
    <DetailLayout>
      <DetectorDetailsHeader detector={detector} useLocalDetailActions />
      <DetailLayout.Body>
        <DetailLayout.Main>
          <Flex align="center" justify="between" gap="md">
            <DatePageFilter />
            <Flex flex={1} justify="end" gap="md">
              <DisableDetectorAction detector={detector} />
              <EditDetectorAction detector={detector} />
            </Flex>
          </Flex>
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
