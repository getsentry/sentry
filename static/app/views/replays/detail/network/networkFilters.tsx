import type {SelectOption} from '@sentry/scraps/compactSelect';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import FiltersGrid from 'sentry/views/replays/detail/filtersGrid';
import type useNetworkFilters from 'sentry/views/replays/detail/network/useNetworkFilters';

type Props = {
  networkFrames: undefined | unknown[];
} & ReturnType<typeof useNetworkFilters>;

function NetworkFilters({
  getMethodTypes,
  getResourceTypes,
  getStatusTypes,
  networkFrames,
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
        onChange={setFilters as (selection: Array<SelectOption<string>>) => void}
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
        trigger={triggerProps => (
          <OverlayTrigger.Button {...triggerProps} prefix={t('Filter')}>
            {selectValue?.length === 0 ? t('Any') : triggerProps.children}
          </OverlayTrigger.Button>
        )}
        value={selectValue}
      />
      <SearchBar
        size="sm"
        onChange={setSearchTerm}
        placeholder={t('Search Network Requests')}
        query={searchTerm}
        disabled={!networkFrames?.length}
      />
    </FiltersGrid>
  );
}

export default NetworkFilters;
