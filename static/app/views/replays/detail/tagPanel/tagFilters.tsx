import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import FiltersGrid from 'sentry/views/replays/detail/filtersGrid';
import useTagFilters from 'sentry/views/replays/detail/tagPanel/useTagFilters';

type Props = {
  actions: undefined | unknown[];
} & ReturnType<typeof useTagFilters>;

function TagFilters({actions, searchTerm, setSearchTerm}: Props) {
  return (
    <FiltersGrid>
      <SearchBar
        size="sm"
        onChange={setSearchTerm}
        placeholder={t('Search Tags')}
        query={searchTerm}
        disabled={!actions || !actions.length}
      />
    </FiltersGrid>
  );
}

export default TagFilters;
