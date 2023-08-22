import {CompactSelect, SelectOption} from 'sentry/components/compactSelect';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import useAccessibilityFilters from 'sentry/views/replays/detail/accessibility/useAccessibilityFilters';
import FiltersGrid from 'sentry/views/replays/detail/filtersGrid';

type Props = {
  accessibilityFrames: undefined | unknown[];
} & ReturnType<typeof useAccessibilityFilters>;

function AccessibilityFilters({
  getResourceTypes,
  accessibilityFrames,
  searchTerm,
  selectValue,
  setFilters,
  setSearchTerm,
}: Props) {
  const resourceTypes = getResourceTypes();

  return (
    <FiltersGrid>
      <CompactSelect
        disabled={!resourceTypes}
        multiple
        onChange={setFilters as (selection: SelectOption<string>[]) => void}
        options={
          [
            // {
            //   label: t('Method'),
            //   options: methodTypes,
            // },
            // {
            //   label: t('Status'),
            //   options: statusTypes,
            // },
            // {
            //   label: t('Type'),
            //   options: resourceTypes,
            // },
          ]
        }
        size="sm"
        triggerLabel={selectValue?.length === 0 ? t('Any') : null}
        triggerProps={{prefix: t('Filter')}}
        value={selectValue}
      />
      <SearchBar
        size="sm"
        onChange={setSearchTerm}
        placeholder={t('Search Accessibility Requests')}
        query={searchTerm}
        disabled={!accessibilityFrames || !accessibilityFrames.length}
      />
    </FiltersGrid>
  );
}

export default AccessibilityFilters;
