import styled from '@emotion/styled';

import CompactSelect from 'sentry/components/compactSelect';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import type {BreadcrumbTypeDefault, Crumb} from 'sentry/types/breadcrumbs';
import useConsoleFilters from 'sentry/views/replays/detail/console/useConsoleFilters';

type Props = {
  breadcrumbs: undefined | Extract<Crumb, BreadcrumbTypeDefault>[];
} & ReturnType<typeof useConsoleFilters>;

function Filters({
  breadcrumbs,
  getOptions,
  logLevel,
  searchTerm,
  setLogLevel,
  setSearchTerm,
}: Props) {
  return (
    <FiltersGrid>
      <CompactSelect
        triggerProps={{prefix: t('Log Level')}}
        triggerLabel={logLevel.length === 0 ? t('Any') : null}
        multiple
        options={getOptions()}
        onChange={selected => setLogLevel(selected.map(_ => _.value))}
        size="sm"
        value={logLevel}
        isDisabled={!breadcrumbs || !breadcrumbs.length}
      />
      <SearchBar
        onChange={setSearchTerm}
        placeholder={t('Search Console Logs')}
        size="sm"
        query={searchTerm}
        disabled={!breadcrumbs || !breadcrumbs.length}
      />
    </FiltersGrid>
  );
}

const FiltersGrid = styled('div')`
  display: grid;
  gap: ${space(1)};
  grid-template-columns: max-content 1fr;
  margin-bottom: ${space(1)};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    margin-top: ${space(1)};
  }
`;

export default Filters;
