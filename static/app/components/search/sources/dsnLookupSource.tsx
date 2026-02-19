import {useMemo} from 'react';

import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import {DSN_PATTERN, getDsnNavTargets} from './dsnLookupUtils';
import type {DsnLookupResponse} from './dsnLookupUtils';
import type {ChildProps} from './types';
import {makeResolvedTs} from './utils';

type Props = {
  children: (props: ChildProps) => React.ReactElement;
  query: string;
};

function DsnLookupSource({query, children}: Props) {
  const organization = useOrganization({allowNull: true});
  const hasDsnLookup = organization?.features?.includes('cmd-k-dsn-lookup') ?? false;
  const isDsn = DSN_PATTERN.test(query);

  const {data, isLoading} = useApiQuery<DsnLookupResponse>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/dsn-lookup/', {
        path: {organizationIdOrSlug: organization?.slug ?? ''},
      }),
      {query: {dsn: query}},
    ],
    {
      staleTime: 30_000,
      enabled: isDsn && !!organization && hasDsnLookup,
    }
  );

  const results = useMemo(() => {
    if (!data) {
      return [];
    }

    const resolvedTs = makeResolvedTs();

    return getDsnNavTargets(data).map((target, i) => ({
      item: {
        title: target.label,
        description: target.description,
        sourceType: 'dsn-lookup' as const,
        resultType: 'route' as const,
        resolvedTs,
        to: target.to,
      },
      score: 0,
      refIndex: i,
    }));
  }, [data]);

  return children({isLoading, results});
}

export default DsnLookupSource;
