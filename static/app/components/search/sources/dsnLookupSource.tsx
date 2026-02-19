import {useEffect, useMemo, useState} from 'react';

import {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

import {DSN_PATTERN} from './dsnLookupUtils';
import type {DsnLookupResponse} from './dsnLookupUtils';
import type {ChildProps, ResultItem} from './types';
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
    const {organizationSlug, projectSlug, projectId, projectName} = data;

    const items: ResultItem[] = [
      {
        title: t('Issues for %s', projectName),
        description: t('View issues'),
        sourceType: 'dsn-lookup',
        resultType: 'route',
        resolvedTs,
        to: `/organizations/${organizationSlug}/issues/?project=${projectId}`,
      },
      {
        title: t('%s Settings', projectName),
        description: t('Project settings'),
        sourceType: 'dsn-lookup',
        resultType: 'route',
        resolvedTs,
        to: `/settings/${organizationSlug}/projects/${projectSlug}/`,
      },
      {
        title: t('Client Keys (DSN) for %s', projectName),
        description: t('Manage DSN keys'),
        sourceType: 'dsn-lookup',
        resultType: 'route',
        resolvedTs,
        to: `/settings/${organizationSlug}/projects/${projectSlug}/keys/`,
      },
    ];

    return items.map((item, i) => ({item, score: 0, refIndex: i}));
  }, [data]);

  return children({isLoading, results});
}

export default DsnLookupSource;
