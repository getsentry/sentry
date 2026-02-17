import {useEffect, useMemo, useState} from 'react';

import {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

import type {ChildProps, ResultItem} from './types';
import {makeResolvedTs} from './utils';

const DSN_PATTERN = /^https?:\/\/([a-f0-9]{32})(:[a-f0-9]{32})?@[^/]+\/\d+$/;

interface DsnLookupResponse {
  keyId: string;
  keyLabel: string;
  organizationSlug: string;
  projectId: string;
  projectName: string;
  projectPlatform: string | null;
  projectSlug: string;
}

type Props = {
  children: (props: ChildProps) => React.ReactElement;
  query: string;
};

function DsnLookupSource({query, children}: Props) {
  const organization = useOrganization();
  const hasDsnLookup = organization.features.includes('cmd-k-dsn-lookup');
  const isDsn = DSN_PATTERN.test(query);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<DsnLookupResponse | null>(null);

  useEffect(() => {
    if (!hasDsnLookup || !isDsn) {
      setData(null);
      return undefined;
    }

    setIsLoading(true);
    const api = new Client();
    let cancelled = false;

    api
      .requestPromise('/dsn-lookup/', {query: {dsn: query}})
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
  }, [hasDsnLookup, isDsn, query]);

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
