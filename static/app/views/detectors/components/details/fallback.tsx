import DetailLayout from 'sentry/components/workflowEngine/layout/detail';
import type {Project} from 'sentry/types/project';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {DetectorDetailsAssignee} from 'sentry/views/detectors/components/details/common/assignee';
import {DetectorDetailsAutomations} from 'sentry/views/detectors/components/details/common/automations';
import {DetectorExtraDetails} from 'sentry/views/detectors/components/details/common/extraDetails';
import {DetectorDetailsHeader} from 'sentry/views/detectors/components/details/common/header';
import {DetectorDetailsOngoingIssues} from 'sentry/views/detectors/components/details/common/ongoingIssues';

type FallbackDetectorDetailsProps = {
  detector: Detector;
  project: Project;
};

export function FallbackDetectorDetails({
  detector,
  project,
}: FallbackDetectorDetailsProps) {
  return (
    <DetailLayout>
      <DetectorDetailsHeader detector={detector} project={project} />
      <DetailLayout.Body>
        <DetailLayout.Main>
          <DetectorDetailsOngoingIssues />
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
