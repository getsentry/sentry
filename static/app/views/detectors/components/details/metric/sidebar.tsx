import {Fragment} from 'react';
import {Link} from 'react-router-dom';

import {Tooltip} from 'sentry/components/core/tooltip';
import ErrorBoundary from 'sentry/components/errorBoundary';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t} from 'sentry/locale';
import type {MetricDetector} from 'sentry/types/workflowEngine/detectors';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {DetectorDetailsAssignee} from 'sentry/views/detectors/components/details/common/assignee';
import {DetectorDetailsDescription} from 'sentry/views/detectors/components/details/common/description';
import {DetectorExtraDetails} from 'sentry/views/detectors/components/details/common/extraDetails';
import {MetricDetectorDetailsDetect} from 'sentry/views/detectors/components/details/metric/detect';

interface DetectorDetailsSidebarProps {
  detector: MetricDetector;
}

function GoToMetricAlert({detector}: {detector: MetricDetector}) {
  const organization = useOrganization();
  const user = useUser();
  if (!user.isSuperuser || !detector.alertRuleId) {
    return null;
  }

  return (
    <div>
      <Tooltip title="Superuser only" skipWrapper>
        <Link
          to={normalizeUrl(
            `/organizations/${organization.slug}/issues/alerts/rules/details/${detector.alertRuleId}/`
          )}
        >
          View Metric Alert
        </Link>
      </Tooltip>
    </div>
  );
}

export function MetricDetectorDetailsSidebar({detector}: DetectorDetailsSidebarProps) {
  return (
    <Fragment>
      <Section title={t('Detect')}>
        <ErrorBoundary mini>
          <MetricDetectorDetailsDetect detector={detector} />
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
      <GoToMetricAlert detector={detector} />
    </Fragment>
  );
}
