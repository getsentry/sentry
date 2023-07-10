import {CompactSelect, SelectOption} from 'sentry/components/compactSelect';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import FiltersGrid from 'sentry/views/replays/detail/filtersGrid';
import useNetworkFilters from 'sentry/views/replays/detail/network/useNetworkFilters';
import type {NetworkSpan} from 'sentry/views/replays/types';

type Props = {
  networkSpans: undefined | NetworkSpan[];
} & ReturnType<typeof useNetworkFilters>;

function NetworkFilters({
  getMethodTypes,
  getResourceTypes,
  getStatusTypes,
  networkSpans,
  searchTerm,
  selectValue,
  setFilters,
  setSearchTerm,
}: Props) {
  const methodTypes = getMethodTypes();
  const statusTypes = getStatusTypes();
  const resourceTypes = getResourceTypes();

  return (
    <FiltersGrid>
      <CompactSelect
        disabled={!methodTypes.length && !statusTypes.length && !resourceTypes}
        multiple
        onChange={setFilters as (selection: SelectOption<string>[]) => void}
        options={[
          {
            label: t('Method'),
            options: methodTypes,
          },
          {
            label: t('Status'),
            options: statusTypes,
          },
          {
            label: t('Type'),
            options: resourceTypes,
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
        placeholder={t('Search Network Requests')}
        query={searchTerm}
        disabled={!networkSpans || !networkSpans.length}
      />
    </FiltersGrid>
  );
}

export default NetworkFilters;
