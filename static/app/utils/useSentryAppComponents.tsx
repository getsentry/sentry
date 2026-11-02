import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';

import type {
  SentryAppComponent,
  SentryAppSchemaElement,
  SentryAppSchemaStacktraceLink,
} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

export function sentryAppComponentsApiOptions({orgSlug}: {orgSlug: string}) {
  return apiOptions.as<SentryAppComponent[]>()(
    '/organizations/$organizationIdOrSlug/sentry-app-components/',
    {
      path: {organizationIdOrSlug: orgSlug},
      staleTime: Infinity,
    }
  );
}

export function useSentryAppComponents<
  Schema extends SentryAppSchemaStacktraceLink | SentryAppSchemaElement =
    | SentryAppSchemaStacktraceLink
    | SentryAppSchemaElement,
>({
  componentType,
  enabled = true,
}: {
  componentType: SentryAppComponent['type'];
  enabled?: boolean;
}): Array<SentryAppComponent<Schema>> {
  const organization = useOrganization();
  const {data} = useQuery({
    ...sentryAppComponentsApiOptions({orgSlug: organization.slug}),
    enabled,
  });

  return useMemo(
    () =>
      (data ?? []).filter(item => item.type === componentType) as Array<
        SentryAppComponent<Schema>
      >,
    [data, componentType]
  );
}
