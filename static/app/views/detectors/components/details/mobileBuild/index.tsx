import {Flex} from '@sentry/scraps/layout';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {DetailLayout} from 'sentry/components/workflowEngine/layout/detail';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import type {PreprodDetector} from 'sentry/types/workflowEngine/detectors';
import {
  DisableDetectorAction,
  EditDetectorAction,
} from 'sentry/views/detectors/components/details/common/actions';
import {DetectorDetailsAutomations} from 'sentry/views/detectors/components/details/common/automations';
import {DisabledAlert} from 'sentry/views/detectors/components/details/common/disabledAlert';
import {DetectorDetailsHeader} from 'sentry/views/detectors/components/details/common/header';
import {DetectorDetailsOpenPeriodIssues} from 'sentry/views/detectors/components/details/common/openPeriodIssues';
import {MobileBuildDetectorDetailsSidebar} from 'sentry/views/detectors/components/details/mobileBuild/sidebar';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

type MobileBuildDetectorDetailsProps = {
  detector: PreprodDetector;
  project: Project;
};

export function MobileBuildDetectorDetails({
  detector,
  project,
}: MobileBuildDetectorDetailsProps) {
  const hasPageFrameFeature = useHasPageFrameFeature();

  return (
    <DetailLayout>
      <DetectorDetailsHeader detector={detector} project={project} />
      <DetailLayout.Body>
        <DetailLayout.Main>
          <DisabledAlert
            detector={detector}
            message={t('This monitor is disabled and not creating issues.')}
          />
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
          <MobileBuildDetectorDetailsSidebar detector={detector} />
        </DetailLayout.Sidebar>
      </DetailLayout.Body>
    </DetailLayout>
  );
}
