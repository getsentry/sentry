import {Fragment} from 'react';

import {CompactSelect, type SelectOption} from '@sentry/scraps/compactSelect';
import {Input} from '@sentry/scraps/input';

import type {RepoFilter} from 'sentry/components/repositories/scmIntegrationTree/types';
import {t} from 'sentry/locale';

const REPO_FILTER_OPTIONS: Array<SelectOption<RepoFilter>> = [
  {value: 'all' as const, label: t('All repos')},
  {value: 'connected' as const, label: t('Connected Repos')},
  {value: 'not-connected' as const, label: t('Disconnected Repos')},
];

interface Props {
  repoFilter: RepoFilter;
  searchTerm: string;
  setRepoFilter: (repoFilter: RepoFilter) => void;
  setSearchTerm: (searchTerm: string) => void;
}

export default function ScmTreeFilters({
  repoFilter,
  setRepoFilter,
  searchTerm,
  setSearchTerm,
}: Props) {
  return (
    <Fragment>
      <CompactSelect
        value={repoFilter}
        onChange={(opt: SelectOption<RepoFilter>) => setRepoFilter(opt.value)}
        options={REPO_FILTER_OPTIONS}
      />
      <Input
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        placeholder={t('Search repos\u2026')}
        style={{flex: 1}}
      />
    </Fragment>
  );
}
