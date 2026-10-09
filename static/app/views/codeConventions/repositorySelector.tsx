import {useInfiniteQuery} from '@tanstack/react-query';
import uniqBy from 'lodash/uniqBy';

import {CompactSelect} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {
  isSeerSupportedProvider,
  useSeerSupportedProviderIds,
} from 'sentry/components/events/autofix/utils';
import {t} from 'sentry/locale';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import {organizationRepositoriesWithSettingsInfiniteOptions} from 'sentry/utils/repositories/repoQueryOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

interface Props {
  repoName: string;
}

/**
 * Offers the same repositories as the Seer Code Review settings, but stays
 * locked to `repoName` until other repos are supported.
 */
export function RepositorySelector({repoName}: Props) {
  const organization = useOrganization();
  const supportedProviderIds = useSeerSupportedProviderIds();

  const result = useInfiniteQuery({
    ...organizationRepositoriesWithSettingsInfiniteOptions({
      organization,
      query: {per_page: 100},
    }),
    select: ({pages}) =>
      uniqBy(
        pages.flatMap(page => page.json),
        'externalId'
      )
        .filter(
          repository =>
            repository.externalId &&
            isSeerSupportedProvider(repository.provider, supportedProviderIds)
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
  });
  useFetchAllPages({result});

  const repositories = result.data ?? [];
  const options = repositories.map(repository => ({
    value: repository.id,
    label: repository.name,
    textValue: repository.name,
    leadingItems: getIntegrationIcon(repository.provider.name.toLowerCase()),
  }));
  const selected = repositories.find(repository => repository.name === repoName);

  return (
    <CompactSelect
      disabled
      search
      loading={result.isPending}
      value={selected?.id}
      options={options}
      onChange={() => {}}
      trigger={triggerProps => (
        <OverlayTrigger.Button
          {...triggerProps}
          prefix={t('Repository')}
          tooltipProps={{title: t('Alpha: Only getsentry/sentry is supported')}}
        >
          {selected ? triggerProps.children : repoName}
        </OverlayTrigger.Button>
      )}
    />
  );
}
