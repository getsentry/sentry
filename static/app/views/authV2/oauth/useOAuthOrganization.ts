import {useState} from 'react';

import {ConfigStore} from 'sentry/stores/configStore';

import type {OAuthOrganization} from './types';

export function useOAuthOrganization(
  organizations: OAuthOrganization[],
  consentKey: string | undefined
) {
  const [selection, setSelection] = useState<{
    consentKey: string | undefined;
    organizationId: string;
  }>();
  const lastOrganization = ConfigStore.get('lastOrganization');
  const selected =
    selection?.consentKey === consentKey
      ? organizations.find(organization => organization.id === selection?.organizationId)
      : undefined;
  const organization =
    selected ??
    organizations.find(option => option.slug === lastOrganization) ??
    organizations[0];

  return {
    organization,
    onChange: (organizationId: string) => setSelection({consentKey, organizationId}),
  };
}
