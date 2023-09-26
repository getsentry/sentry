import {CompactSelect} from 'sentry/components/compactSelect';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import useBreadcrumbFilters from 'sentry/views/replays/detail/breadcrumbs/useBreadcrumbFilters';
import FiltersGrid from 'sentry/views/replays/detail/filtersGrid';

type Props = {
  actions: undefined | unknown[];
} & ReturnType<typeof useBreadcrumbFilters>;

function BreadcrumbFilters({
  actions,
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
        triggerProps={{prefix: t('Type')}}
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
        placeholder={t('Search Breadcrumb Events')}
        query={searchTerm}
        disabled={!actions || !actions.length}
      />
    </FiltersGrid>
  );
}

export default BreadcrumbFilters;
