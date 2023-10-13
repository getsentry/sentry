import {CompactSelect} from 'sentry/components/compactSelect';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import useBreadcrumbFilters from 'sentry/views/replays/detail/breadcrumbs/useBreadcrumbFilters';
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
        triggerProps={{prefix: t('Type')}}
        triggerLabel={type.length === 0 ? t('Any') : null}
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
        disabled={!frames || !frames.length}
      />
    </FiltersGrid>
  );
}

export default BreadcrumbFilters;
