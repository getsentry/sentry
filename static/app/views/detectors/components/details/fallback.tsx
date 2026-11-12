import {Flex} from '@sentry/scraps/layout';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {DetailLayout} from 'sentry/components/workflowEngine/layout/detail';
import type {Detector} from 'sentry/types/workflowEngine/detectors';

import {DisableDetectorAction, EditDetectorAction} from './common/actions';
import {DetectorDetailsAssignee} from './common/assignee';
import {DetectorDetailsAutomations} from './common/automations';
import {DetectorExtraDetails} from './common/extraDetails';
import {DetectorDetailsHeader} from './common/header';
import {DetectorDetailsOpenPeriodIssues} from './common/openPeriodIssues';

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
