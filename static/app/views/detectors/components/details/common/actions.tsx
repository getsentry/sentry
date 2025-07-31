import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Link} from 'sentry/components/core/link';
import {IconEdit} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import useOrganization from 'sentry/utils/useOrganization';
import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';
import {useCanEditDetector} from 'sentry/views/detectors/utils/useCanEditDetector';

export function DisableDetectorAction({detector}: {detector: Detector}) {
  const canEdit = useCanEditDetector({
    detectorType: detector.type,
    projectId: detector.projectId,
  });

  if (!canEdit) {
    return null;
  }

  /**
   * TODO: Implement disable detector
   */
  return (
    <Button size="sm" onClick={() => {}}>
      {detector.disabled ? t('Enable') : t('Disable')}
    </Button>
  );
}

export function EditDetectorAction({detector}: {detector: Detector}) {
  const organization = useOrganization();
  const canEdit = useCanEditDetector({
    detectorType: detector.type,
    projectId: detector.projectId,
  });

  const permissionTooltipText = tct(
    'You do not have permission to edit this monitor. Ask your organization owner or manager to [settingsLink:enable monitor access] for you.',
    {settingsLink: <Link to={`/settings/${organization.slug}/#alertsMemberWrite`} />}
  );

  return (
    <LinkButton
      to={`${makeMonitorDetailsPathname(organization.slug, detector.id)}edit/`}
      priority="primary"
      icon={<IconEdit />}
      size="sm"
      disabled={!canEdit}
      title={canEdit ? undefined : permissionTooltipText}
      tooltipProps={{isHoverable: true}}
    >
      {t('Edit')}
    </LinkButton>
  );
}
