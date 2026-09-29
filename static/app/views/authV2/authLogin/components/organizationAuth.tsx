import {useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import {getCsrfToken} from 'sentry/utils/getCsrfToken';
import type {AuthOrganization} from 'sentry/views/authV2/authLogin/hooks/useAuthOrganization';

import {OrganizationCard} from './organizationCard';
import {OrganizationJoinRequest} from './organizationJoinRequest';

interface OrganizationAuthProps {
  authOrganization: AuthOrganization;
  hideClearButton?: boolean;
  onClear?: () => void;
}

export function OrganizationAuth({
  authOrganization,
  hideClearButton = false,
  onClear,
}: OrganizationAuthProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {provider} = authOrganization;
  const ssoAction = (
    <form method="POST" onSubmit={() => setIsSubmitting(true)}>
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
  const footer = authOrganization.joinRequestUrl ? (
    <OrganizationJoinRequest organizationSlug={authOrganization.organization.slug} />
  ) : undefined;
  const clearHandler = hideClearButton ? undefined : onClear;

  return (
    <OrganizationCard
      authOrganization={authOrganization}
      action={ssoAction}
      footer={footer}
      onClear={clearHandler}
    />
  );
}
