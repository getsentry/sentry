import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {MonitorFeedbackButton} from 'sentry/views/detectors/components/monitorFeedbackButton';
import {makeMonitorCreatePathname} from 'sentry/views/detectors/pathnames';
import {getNoPermissionToCreateMonitorsTooltip} from 'sentry/views/detectors/utils/monitorAccessMessages';
import {useCanCreateDetector} from 'sentry/views/detectors/utils/useCanCreateDetector';

interface DetectorListActionsProps {
  children?: React.ReactNode;
}

export function DetectorListActions({children}: DetectorListActionsProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const project = selection.projects.find(pid => pid !== ALL_ACCESS_PROJECTS);
  const canCreateDetector = useCanCreateDetector(null);

  return (
    <Flex gap="sm">
      {children}
      <MonitorFeedbackButton />
      <LinkButton
        to={{
          pathname: makeMonitorCreatePathname(organization.slug),
          query: {project},
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
