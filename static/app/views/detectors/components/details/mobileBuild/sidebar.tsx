import {Fragment} from 'react';

import ErrorBoundary from 'sentry/components/errorBoundary';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t} from 'sentry/locale';
import type {PreprodDetector} from 'sentry/types/workflowEngine/detectors';
import {DetectorDetailsAssignee} from 'sentry/views/detectors/components/details/common/assignee';
import {DetectorDetailsDescription} from 'sentry/views/detectors/components/details/common/description';
import {DetectorExtraDetails} from 'sentry/views/detectors/components/details/common/extraDetails';
import {MobileBuildDetectorDetailsDetect} from 'sentry/views/detectors/components/details/mobileBuild/detect';

interface MobileBuildDetectorDetailsSidebarProps {
  detector: PreprodDetector;
}

export function MobileBuildDetectorDetailsSidebar({
  detector,
}: MobileBuildDetectorDetailsSidebarProps) {
  return (
    <Fragment>
      <Section title={t('Detect')}>
        <ErrorBoundary mini>
          <MobileBuildDetectorDetailsDetect detector={detector} />
        </ErrorBoundary>
      </Section>
      <DetectorDetailsAssignee owner={detector.owner} />
      <DetectorDetailsDescription description={detector.description} />
      <DetectorExtraDetails>
        <DetectorExtraDetails.DateCreated detector={detector} />
        <DetectorExtraDetails.CreatedBy detector={detector} />
        <DetectorExtraDetails.LastModified detector={detector} />
        <DetectorExtraDetails.Environment detector={detector} />
      </DetectorExtraDetails>
    </Fragment>
  );
}
