import {useEffect, useMemo, useState} from 'react';

import {Client} from 'sentry/api';
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
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<DsnLookupResponse | null>(null);

  useEffect(() => {
    if (!organization || !hasDsnLookup || !isDsn) {
      setData(null);
      setIsLoading(false);
      return undefined;
    }

    setIsLoading(true);
    const api = new Client();
    let cancelled = false;

    api
      .requestPromise(`/organizations/${organization.slug}/dsn-lookup/`, {
        query: {dsn: query},
      })
      .then((response: DsnLookupResponse) => {
        if (!cancelled) {
          setData(response);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [organization, hasDsnLookup, isDsn, query]);

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
