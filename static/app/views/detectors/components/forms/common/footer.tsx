import {Button, LinkButton} from '@sentry/scraps/button';

import EditLayout from 'sentry/components/workflowEngine/layout/edit';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {makeMonitorBasePathname} from 'sentry/views/detectors/pathnames';

interface NewDetectorFooterProps {
  disabledCreate?: string;
  extras?: React.ReactNode;
  maxWidth?: string;
}

export function NewDetectorFooter({
  maxWidth,
  disabledCreate,
  extras,
}: NewDetectorFooterProps) {
  const organization = useOrganization();

  return (
    <EditLayout.Footer label={t('Step 2 of 2')} maxWidth={maxWidth}>
      <LinkButton
        priority="default"
        to={`${makeMonitorBasePathname(organization.slug)}new/`}
      >
        {t('Back')}
      </LinkButton>
      {extras}
      <Button
        priority="primary"
        type="submit"
        disabled={!!disabledCreate}
        title={disabledCreate}
      >
        {t('Create Monitor')}
      </Button>
    </EditLayout.Footer>
  );
}
