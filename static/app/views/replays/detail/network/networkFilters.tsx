import CompactSelect from 'sentry/components/compactSelect';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import FiltersGrid from 'sentry/views/replays/detail/filtersGrid';
import useNetworkFilters from 'sentry/views/replays/detail/network/useNetworkFilters';
import type {NetworkSpan} from 'sentry/views/replays/types';

type Props = {
  networkSpans: undefined | NetworkSpan[];
} & ReturnType<typeof useNetworkFilters>;

function NetworkFilters({
  networkSpans,
  getResourceTypes,
  getStatusTypes,
  searchTerm,
  setSearchTerm,
  setStatus,
  setType,
  status,
  type,
}: Props) {
  return (
    <FiltersGrid>
      <CompactSelect
        triggerProps={{prefix: t('Status')}}
        triggerLabel={status.length === 0 ? t('Any') : null}
        multiple
        options={getStatusTypes()}
        size="sm"
        onChange={selected => setStatus(selected.map(_ => _.value))}
        value={status}
        isDisabled={!networkSpans || !networkSpans.length}
      />
      <CompactSelect
        triggerProps={{prefix: t('Type')}}
        triggerLabel={type.length === 0 ? t('Any') : null}
        multiple
        options={getResourceTypes()}
        size="sm"
        onChange={selected => setType(selected.map(_ => _.value))}
        value={type}
        isDisabled={!networkSpans || !networkSpans.length}
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
