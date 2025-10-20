import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import EditLayout from 'sentry/components/workflowEngine/layout/edit';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {useMonitorViewContext} from 'sentry/views/detectors/monitorViewContext';
import {makeMonitorBasePathname} from 'sentry/views/detectors/pathnames';

export function NewDetectorFooter({maxWidth}: {maxWidth?: string}) {
  const organization = useOrganization();
  const {monitorsLinkPrefix} = useMonitorViewContext();

  return (
    <EditLayout.Footer label={t('Step 2 of 2')} maxWidth={maxWidth}>
      <LinkButton
        priority="default"
        to={`${makeMonitorBasePathname(organization.slug, monitorsLinkPrefix)}new/`}
      >
        {t('Back')}
      </LinkButton>
      <Button priority="primary" type="submit">
        {t('Create Monitor')}
      </Button>
    </EditLayout.Footer>
  );
}
