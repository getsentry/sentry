import {CompactSelect, SelectOption} from 'sentry/components/compactSelect';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import useAccessibilityFilters from 'sentry/views/replays/detail/accessibility/useAccessibilityFilters';
import FiltersGrid from 'sentry/views/replays/detail/filtersGrid';

type Props = {
  accessibilityData: undefined | unknown[];
} & ReturnType<typeof useAccessibilityFilters>;

function AccessibilityFilters({
  getImpactLevels,
  getIssueTypes,
  accessibilityData,
  searchTerm,
  selectValue,
  setFilters,
  setSearchTerm,
}: Props) {
  const impactLevels = getImpactLevels();
  const issueTypes = getIssueTypes();

  return (
    <FiltersGrid>
      <CompactSelect
        disabled={!impactLevels.length && !issueTypes.length}
        multiple
        onChange={setFilters as (selection: SelectOption<string>[]) => void}
        options={[
          {
            label: t('Impact Level'),
            options: impactLevels,
          },
          {
            label: t('Type'),
            options: issueTypes,
          },
        ]}
        size="sm"
        triggerLabel={selectValue?.length === 0 ? t('Any') : null}
        triggerProps={{prefix: t('Filter')}}
        value={selectValue}
      />
      <SearchBar
        size="sm"
        onChange={setSearchTerm}
        placeholder={t('Search Accessibility Issues')}
        query={searchTerm}
        disabled={!accessibilityData || !accessibilityData.length}
      />
    </FiltersGrid>
  );
}

export default AccessibilityFilters;
