import {CompactSelect} from 'sentry/components/compactSelect';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import FiltersGrid from 'sentry/views/replays/detail/filtersGrid';
import useNetworkFilters from 'sentry/views/replays/detail/network/useNetworkFilters';
import type {NetworkSpan} from 'sentry/views/replays/types';

type Props = {
  networkSpans: undefined | NetworkSpan[];
} & ReturnType<typeof useNetworkFilters>;

const NetworkFilters = ({
  networkSpans,
  getResourceTypes,
  getStatusTypes,
  searchTerm,
  setSearchTerm,
  setStatus,
  setType,
  status,
  type,
}: Props) => {
  const statusTypes = getStatusTypes();
  const resourceTypes = getResourceTypes();
  return (
    <FiltersGrid>
      <CompactSelect
        triggerProps={{prefix: t('Status')}}
        triggerLabel={status.length === 0 ? t('Any') : null}
        multiple
        options={statusTypes}
        size="sm"
        onChange={selected => setStatus(selected.map(_ => _.value))}
        value={status}
        disabled={!statusTypes.length}
      />
      <CompactSelect
        triggerProps={{prefix: t('Type')}}
        triggerLabel={type.length === 0 ? t('Any') : null}
        multiple
        options={resourceTypes}
        size="sm"
        onChange={selected => setType(selected.map(_ => _.value))}
        value={type}
        disabled={!resourceTypes.length}
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
};

export default NetworkFilters;
