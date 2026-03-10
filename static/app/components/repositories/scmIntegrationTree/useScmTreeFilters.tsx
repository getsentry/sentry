import {parseAsString, parseAsStringLiteral, useQueryState} from 'nuqs';

import {type SelectOption} from '@sentry/scraps/compactSelect';

import type {RepoFilter} from 'sentry/components/repositories/scmIntegrationTree/types';
import {t} from 'sentry/locale';

const REPO_FILTER_OPTIONS: Array<SelectOption<RepoFilter>> = [
  {value: 'all' as const, label: t('All repos')},
  {value: 'connected' as const, label: t('Connected Repos')},
  {value: 'not-connected' as const, label: t('Disconnected Repos')},
];

const repoParser = parseAsStringLiteral(
  REPO_FILTER_OPTIONS.map(option => option.value)
).withDefault('all');

export default function useScmTreeFilters() {
  const [searchTerm, setSearchTerm] = useQueryState(
    'search',
    parseAsString.withDefault('')
  );
  const [repoFilter, setRepoFilter] = useQueryState('repo', repoParser);

  return {
    repoFilter,
    setRepoFilter,
    searchTerm,
    setSearchTerm,
  };
}
