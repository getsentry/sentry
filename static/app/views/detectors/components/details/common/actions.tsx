import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import useOrganization from 'sentry/utils/useOrganization';
import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';

export function DisableDetectorAction({detector}: {detector: Detector}) {
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

  return (
    <LinkButton
      to={`${makeMonitorDetailsPathname(organization.slug, detector.id)}edit/`}
      priority="primary"
      icon={<IconEdit />}
      size="sm"
    >
      {t('Edit')}
    </LinkButton>
  );
}
