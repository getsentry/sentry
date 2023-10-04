import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import FiltersGrid from 'sentry/views/replays/detail/filtersGrid';
import useTagFilters from 'sentry/views/replays/detail/tagPanel/useTagFilters';

type Props = {
  tagFrames: undefined | unknown[];
} & ReturnType<typeof useTagFilters>;

function TagFilters({tagFrames, searchTerm, setSearchTerm}: Props) {
  return (
    <FiltersGrid>
      <SearchBar
        size="sm"
        onChange={setSearchTerm}
        placeholder={t('Search Tags')}
        query={searchTerm}
        disabled={!tagFrames || !tagFrames.length}
      />
    </FiltersGrid>
  );
}

export default TagFilters;
