import type {SelectOption} from 'sentry/components/compactSelect';
import {CompactSelect} from 'sentry/components/compactSelect';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import FiltersGrid from 'sentry/views/replays/detail/filtersGrid';
import usePerfFilters from 'sentry/views/replays/detail/perfTable/usePerfFilters';

type Props = {
  traceRows: undefined | unknown[];
} & ReturnType<typeof usePerfFilters>;

function PerfFilters({
  traceRows,
  getCrumbTypes,
  searchTerm,
  selectValue,
  setFilters,
  setSearchTerm,
}: Props) {
  const crumbTypes = getCrumbTypes();
  return (
    <FiltersGrid>
      <CompactSelect
        disabled={!crumbTypes.length}
        multiple
        onChange={setFilters as (selection: SelectOption<string>[]) => void}
        options={[
          {
            label: t('Breadcrumb Type'),
            options: crumbTypes,
          },
        ]}
        size="sm"
        triggerLabel={selectValue?.length === 0 ? t('Any') : null}
        triggerProps={{prefix: t('Filter')}}
        value={selectValue}
      />
      <SearchBar
        size="sm"
        onChange={setSearchTerm}
        placeholder={t('Search Events & Traces')}
        query={searchTerm}
        disabled={!traceRows || !traceRows.length}
      />
    </FiltersGrid>
  );
}

export default PerfFilters;
