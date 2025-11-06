import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {DetectorType} from 'sentry/types/workflowEngine/detectors';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {MonitorFeedbackButton} from 'sentry/views/detectors/components/monitorFeedbackButton';
import {makeMonitorCreatePathname} from 'sentry/views/detectors/pathnames';

interface DetectorListActionsProps {
  children?: React.ReactNode;
  detectorType?: DetectorType;
}

export function DetectorListActions({detectorType, children}: DetectorListActionsProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const createPath = makeMonitorCreatePathname(organization.slug);
  // If detectorFilter is set, pass it as a query param to skip type selection
  const project = selection.projects.find(pid => pid !== ALL_ACCESS_PROJECTS);
  const createQuery = detectorType ? {project, detectorType} : {project};

  return (
    <Flex gap="sm">
      {children}
      <MonitorFeedbackButton />
      <LinkButton
        to={{
          pathname: createPath,
          query: createQuery,
        }}
        priority="primary"
        icon={<IconAdd />}
        size="sm"
      >
        {t('Create Monitor')}
      </LinkButton>
    </Flex>
  );
}
