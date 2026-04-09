import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import type {TourStep} from 'sentry/components/modals/featureTourModal';
import {TourText} from 'sentry/components/modals/featureTourModal';
import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {WorkflowEngineFeatureTourButton} from 'sentry/components/workflowEngine/featureTourButton';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {DetectorType} from 'sentry/types/workflowEngine/detectors';
import {useOrganization} from 'sentry/utils/useOrganization';
import {MonitorFeedbackButton} from 'sentry/views/detectors/components/monitorFeedbackButton';
import {makeMonitorCreatePathname} from 'sentry/views/detectors/pathnames';
import {getNoPermissionToCreateMonitorsTooltip} from 'sentry/views/detectors/utils/monitorAccessMessages';
import {useCanCreateDetector} from 'sentry/views/detectors/utils/useCanCreateDetector';

const DOCS_URL = 'https://docs.sentry.io/product/new-monitors-and-alerts/monitors/';

const DETECTOR_TOUR_STEPS: TourStep[] = [
  {
    title: t('What are Monitors?'),
    body: (
      <TourText>
        {t(
          'Monitors detect changes in your application like new errors, performance regressions, and other anomalies, then create issues for your team to investigate.'
        )}
      </TourText>
    ),
  },
  {
    title: t('Creating a Monitor'),
    body: (
      <TourText>
        {t(
          'Create monitors to track specific conditions such as error thresholds, uptime checks, or cron job failures. Each monitor can be connected to one or more alerts.'
        )}
      </TourText>
    ),
  },
  {
    title: t('Managing Monitors'),
    body: (
      <TourText>
        {t(
          'Use this page to view, search, and manage all your monitors. You can filter by project and monitor type to find what you need.'
        )}
      </TourText>
    ),
  },
];

interface DetectorListActionsProps {
  children?: React.ReactNode;
  detectorType?: DetectorType;
}

export function DetectorListActions({children, detectorType}: DetectorListActionsProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const project = selection.projects.find(pid => pid !== ALL_ACCESS_PROJECTS);
  const canCreateDetector = useCanCreateDetector(null);

  return (
    <Flex gap="sm">
      <WorkflowEngineFeatureTourButton steps={DETECTOR_TOUR_STEPS} doneUrl={DOCS_URL} />
      {children}
      <MonitorFeedbackButton />
      <LinkButton
        to={{
          pathname: makeMonitorCreatePathname(organization.slug),
          query: {project, detectorType},
        }}
        priority="primary"
        icon={<IconAdd />}
        size="sm"
        disabled={!canCreateDetector}
        tooltipProps={{
          title: canCreateDetector ? undefined : getNoPermissionToCreateMonitorsTooltip(),
        }}
      >
        {t('Create Monitor')}
      </LinkButton>
    </Flex>
  );
}
