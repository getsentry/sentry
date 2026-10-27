import {useMemo} from 'react';
import {skipToken, useQuery} from '@tanstack/react-query';

import type {
  SentryAppComponent,
  SentryAppSchemaElement,
  SentryAppSchemaStacktraceLink,
} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

export function sentryAppComponentsApiOptions({
  orgSlug,
  projectId,
}: {
  orgSlug: string;
  projectId: string | undefined;
}) {
  return apiOptions.as<SentryAppComponent[]>()(
    '/organizations/$organizationIdOrSlug/sentry-app-components/',
    {
      path: projectId ? {organizationIdOrSlug: orgSlug} : skipToken,
      query: {projectId},
      staleTime: Infinity,
    }
  );
}

export function useSentryAppComponents<
  Schema extends SentryAppSchemaStacktraceLink | SentryAppSchemaElement =
    | SentryAppSchemaStacktraceLink
    | SentryAppSchemaElement,
>({
  projectId,
  componentType,
  enabled = true,
}: {
  componentType: undefined | SentryAppComponent['type'];
  projectId: string | undefined;
  /**
   * Pass false to only read components that are already cached. Issue details
   * prefetches them, so stack trace frames don't fetch on every surface.
   */
  enabled?: boolean;
}): Array<SentryAppComponent<Schema>> {
  const organization = useOrganization();
  const {data} = useQuery({
    ...sentryAppComponentsApiOptions({orgSlug: organization.slug, projectId}),
    enabled: enabled && Boolean(projectId),
  });

  return useMemo(() => {
    const components = data ?? [];
    const filtered = componentType
      ? components.filter(item => item.type === componentType)
      : components;
    return filtered as Array<SentryAppComponent<Schema>>;
  }, [data, componentType]);
}
