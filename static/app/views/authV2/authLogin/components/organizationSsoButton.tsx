import {useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import {getCsrfToken} from 'sentry/utils/getCsrfToken';
import type {AuthOrganization} from 'sentry/views/authV2/authLogin/hooks/useAuthOrganization';

interface OrganizationSsoButtonProps {
  authOrganization: AuthOrganization;
  hideWhenUnavailable?: boolean;
  ssoFormAction?: string;
}

export function OrganizationSsoButton({
  authOrganization,
  hideWhenUnavailable = false,
  ssoFormAction,
}: OrganizationSsoButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {provider} = authOrganization;

  if (!provider && hideWhenUnavailable) {
    return null;
  }

  return (
    <form action={ssoFormAction} method="POST" onSubmit={() => setIsSubmitting(true)}>
      <input type="hidden" name="csrfmiddlewaretoken" value={getCsrfToken()} />
      <input type="hidden" name="init" value="1" />
      <Tooltip
        disabled={Boolean(provider)}
        title={t('This organization does not have Single Sign-On configured')}
      >
        <Button
          busy={isSubmitting}
          disabled={!provider}
          type="submit"
          variant={provider ? 'primary' : undefined}
        >
          {t('SSO')}
        </Button>
      </Tooltip>
    </form>
  );
}
