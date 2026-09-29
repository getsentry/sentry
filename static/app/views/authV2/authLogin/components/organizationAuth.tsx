import type {AuthOrganization} from 'sentry/views/authV2/authLogin/hooks/useAuthOrganization';

import {OrganizationCard} from './organizationCard';
import {OrganizationJoinRequest} from './organizationJoinRequest';
import {OrganizationSsoButton} from './organizationSsoButton';

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
  const action = <OrganizationSsoButton authOrganization={authOrganization} />;
  const footer = authOrganization.joinRequestUrl ? (
    <OrganizationJoinRequest organizationSlug={authOrganization.organization.slug} />
  ) : undefined;
  const clearHandler = hideClearButton ? undefined : onClear;

  return (
    <OrganizationCard
      authOrganization={authOrganization}
      action={action}
      footer={footer}
      onClear={clearHandler}
    />
  );
}
