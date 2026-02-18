import {useMemo} from 'react';

import type {CommandPaletteActionWithKey} from 'sentry/components/commandPalette/types';
import {DSN_PATTERN} from 'sentry/components/search/sources/dsnLookupUtils';
import type {DsnLookupResponse} from 'sentry/components/search/sources/dsnLookupUtils';
import {IconIssues, IconList, IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import useOrganization from 'sentry/utils/useOrganization';

export function useDsnLookupActions(query: string): CommandPaletteActionWithKey[] {
  const organization = useOrganization({allowNull: true});
  const debouncedQuery = useDebouncedValue(query, 300);
  const isDsn = DSN_PATTERN.test(debouncedQuery);

  const {data} = useApiQuery<DsnLookupResponse>(
    [`/organizations/${organization?.slug}/dsn-lookup/`, {query: {dsn: debouncedQuery}}],
    {
      staleTime: 30_000,
      enabled: isDsn && !!organization,
    }
  );

  return useMemo(() => {
    if (!data) {
      return [];
    }

    const orgSlug = data.organizationSlug;
    const projectSlug = data.projectSlug;
    const projectId = data.projectId;
    const projectName = data.projectName;

    const actions: CommandPaletteActionWithKey[] = [
      {
        key: 'dsn-lookup-issues',
        type: 'navigate',
        to: `/organizations/${orgSlug}/issues/?project=${projectId}`,
        display: {
          label: t('Issues for %s', projectName),
          details: t('View issues'),
          icon: <IconIssues />,
        },
        groupingKey: 'search-result',
      },
      {
        key: 'dsn-lookup-project-settings',
        type: 'navigate',
        to: `/settings/${orgSlug}/projects/${projectSlug}/`,
        display: {
          label: t('%s Settings', projectName),
          details: t('Project settings'),
          icon: <IconSettings />,
        },
        groupingKey: 'search-result',
      },
      {
        key: 'dsn-lookup-client-keys',
        type: 'navigate',
        to: `/settings/${orgSlug}/projects/${projectSlug}/keys/`,
        display: {
          label: t('Client Keys (DSN) for %s', projectName),
          details: t('Manage DSN keys'),
          icon: <IconList />,
        },
        groupingKey: 'search-result',
      },
    ];

    return actions;
  }, [data]);
}
