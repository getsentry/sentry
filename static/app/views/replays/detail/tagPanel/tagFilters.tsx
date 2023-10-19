import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import FiltersGrid from 'sentry/views/replays/detail/filtersGrid';
import useTagFilters from 'sentry/views/replays/detail/tagPanel/useTagFilters';

type Props = {
  tags: undefined | Record<string, string[]>;
} & ReturnType<typeof useTagFilters>;

function TagFilters({tags, searchTerm, setSearchTerm}: Props) {
  return (
    <FiltersGrid>
      <SearchBar
        size="sm"
        onChange={setSearchTerm}
        placeholder={t('Search Tags')}
        query={searchTerm}
        disabled={!tags || !Object.keys(tags).length}
      />
    </FiltersGrid>
  );
}

export default TagFilters;
