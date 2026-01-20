import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import type useBreadcrumbFilters from 'sentry/views/replays/detail/breadcrumbs/useBreadcrumbFilters';
import FiltersGrid from 'sentry/views/replays/detail/filtersGrid';

type Props = {
  frames: undefined | unknown[];
} & ReturnType<typeof useBreadcrumbFilters>;

function BreadcrumbFilters({
  frames,
  getBreadcrumbTypes,
  searchTerm,
  setSearchTerm,
  setType,
  type,
}: Props) {
  const breadcrumbTypes = getBreadcrumbTypes();
  return (
    <FiltersGrid>
      <CompactSelect
        trigger={triggerProps => (
          <OverlayTrigger.Button {...triggerProps} prefix={t('Type')}>
            {type.length === 0 ? t('Any') : triggerProps.children}
          </OverlayTrigger.Button>
        )}
        multiple
        options={breadcrumbTypes}
        size="sm"
        onChange={selected => setType(selected.map(({value}) => value))}
        value={type}
        disabled={!breadcrumbTypes.length}
      />
      <SearchBar
        size="sm"
        onChange={setSearchTerm}
        placeholder={t('Search Breadcrumb Events')}
        query={searchTerm}
        disabled={!frames?.length}
      />
    </FiltersGrid>
  );
}

export default BreadcrumbFilters;
