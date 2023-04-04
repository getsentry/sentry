import {CompactSelect} from 'sentry/components/compactSelect';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import {Extraction} from 'sentry/utils/replays/hooks/useExtractedCrumbHtml';
import useDomFilters from 'sentry/views/replays/detail/domMutations/useDomFilters';
import FiltersGrid from 'sentry/views/replays/detail/filtersGrid';

type Props = {actions: undefined | Extraction[]} & ReturnType<typeof useDomFilters>;

const DomFilters = ({
  actions,
  getMutationsTypes,
  searchTerm,
  setSearchTerm,
  setType,
  type,
}: Props) => {
  const mutationTypes = getMutationsTypes();
  return (
    <FiltersGrid>
      <CompactSelect
        triggerProps={{prefix: t('Event Type')}}
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
        placeholder={t('Search DOM Events')}
        query={searchTerm}
        disabled={!actions || !actions.length}
      />
    </FiltersGrid>
  );
};

export default DomFilters;
