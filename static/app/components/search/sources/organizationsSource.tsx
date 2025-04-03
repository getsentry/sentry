import {useCallback, useEffect, useMemo, useState} from 'react';

import {t} from 'sentry/locale';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Fuse} from 'sentry/utils/fuzzySearch';
import {createFuzzySearch} from 'sentry/utils/fuzzySearch';

import type {ChildProps, ResultItem} from './types';
import {makeResolvedTs} from './utils';

type Props = {
  children: (props: ChildProps) => React.ReactElement;
  /**
   * search term
   */
  query: string;
  /**
   * fuse.js options
   */
  searchOptions?: Fuse.IFuseOptions<ResultItem>;
};

function OrganizationsSource({children, query, searchOptions}: Props) {
  const {organizations, loaded} = useLegacyStore(OrganizationsStore);
  const [fuzzy, setFuzzy] = useState<Fuse<ResultItem> | null>(null);

  const createSearch = useCallback(async () => {
    const resolvedTs = makeResolvedTs();
    setFuzzy(
      await createFuzzySearch<ResultItem>(
        organizations.map(
          org =>
            ({
              title: org.name,
              description: t('Switch to the %s organization', org.slug),
              to: `/${org.slug}/`,
              model: org,
              sourceType: 'organization',
              resultType: 'route',
              resolvedTs,
            }) as ResultItem
        ),
        {
          ...searchOptions,
          keys: ['title', 'description', 'model.slug'],
        }
      )
    );
  }, [organizations, searchOptions]);

  useEffect(() => void createSearch(), [createSearch]);

  const results = useMemo(() => fuzzy?.search(query) ?? [], [fuzzy, query]);

  return children({results, isLoading: !loaded});
}

export default OrganizationsSource;
