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
  getMutationsTypes,
  searchTerm,
  setSearchTerm,
  setType,
  type,
}: Props) {
  const mutationTypes = getMutationsTypes();
  return (
    <FiltersGrid>
      <CompactSelect
        triggerProps={{prefix: t('Event Type')}}
        triggerLabel={type.length === 0 ? t('Any') : null}
        multiple
        options={mutationTypes}
        size="sm"
        onChange={selected => setType(selected.map(_ => _.value))}
        value={type}
        disabled={!mutationTypes.length}
      />
      <SearchBar
        size="sm"
        onChange={setSearchTerm}
        placeholder={t('Search DOM Events')}
        query={searchTerm}
        disabled={!traceRows || !traceRows.length}
      />
    </FiltersGrid>
  );
}

export default PerfFilters;
