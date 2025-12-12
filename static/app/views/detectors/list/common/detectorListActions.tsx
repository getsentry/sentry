import {Link} from '@sentry/scraps/link';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {IconAdd} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {DetectorType} from 'sentry/types/workflowEngine/detectors';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {MonitorFeedbackButton} from 'sentry/views/detectors/components/monitorFeedbackButton';
import {
  makeMonitorCreatePathname,
  makeMonitorCreateSettingsPathname,
} from 'sentry/views/detectors/pathnames';
import {detectorTypeIsUserCreateable} from 'sentry/views/detectors/utils/detectorTypeConfig';
import {useCanCreateDetector} from 'sentry/views/detectors/utils/useCanCreateDetector';

interface DetectorListActionsProps {
  detectorType: DetectorType | null;
  children?: React.ReactNode;
}

function getPermissionTooltipText({
  organization,
  detectorType,
}: {
  detectorType: DetectorType | null;
  organization: Organization;
}) {
  const noPermissionText = tct(
    'You do not have permission to create monitors. Ask your organization owner or manager to [settingsLink:enable monitor access] for you.',
    {
      settingsLink: (
        <Link
          to={{
            pathname: `/settings/${organization.slug}/`,
            hash: 'alertsMemberWrite',
          }}
        />
      ),
    }
  );

  if (!detectorType || detectorTypeIsUserCreateable(detectorType)) {
    return noPermissionText;
  }

  return t('This monitor type is managed by Sentry.');
}

export function DetectorListActions({detectorType, children}: DetectorListActionsProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const createPath = detectorType
    ? makeMonitorCreateSettingsPathname(organization.slug)
    : makeMonitorCreatePathname(organization.slug);
  const project = selection.projects.find(pid => pid !== ALL_ACCESS_PROJECTS);
  const createQuery = detectorType ? {project, detectorType} : {project};
  const canCreateDetector = useCanCreateDetector(detectorType);

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
        disabled={!canCreateDetector}
        title={
          canCreateDetector
            ? undefined
            : getPermissionTooltipText({
                organization,
                detectorType,
              })
        }
      >
        {t('Create Monitor')}
      </LinkButton>
    </Flex>
  );
}
