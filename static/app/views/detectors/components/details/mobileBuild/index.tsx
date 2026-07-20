import {Flex} from '@sentry/scraps/layout';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {DetailLayout} from 'sentry/components/workflowEngine/layout/detail';
import {t} from 'sentry/locale';
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

type MobileBuildDetectorDetailsProps = {
  detector: PreprodDetector;
};

export function MobileBuildDetectorDetails({detector}: MobileBuildDetectorDetailsProps) {
  return (
    <DetailLayout>
      <DetectorDetailsHeader detector={detector} />
      <DetailLayout.Body>
        <DetailLayout.Main>
          <DisabledAlert
            detector={detector}
            message={t('This monitor is disabled and not creating issues.')}
          />
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
          <MobileBuildDetectorDetailsSidebar detector={detector} />
        </DetailLayout.Sidebar>
      </DetailLayout.Body>
    </DetailLayout>
  );
}
