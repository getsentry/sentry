import {CompactSelect} from 'sentry/components/core/compactSelect';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import FiltersGrid from 'sentry/views/replays/detail/filtersGrid';
import type useOurLogFilters from 'sentry/views/replays/detail/ourlogs/useOurLogFilters';

type Props = {
  logItems: OurLogsResponseItem[];
} & ReturnType<typeof useOurLogFilters>;

export function OurLogFilters({
  logItems,
  getSeverityLevels,
  searchTerm,
  selectValues,
  setSeverityLevel,
  setSearchTerm,
}: Props) {
  const severityLevels = getSeverityLevels();

  return (
    <FiltersGrid>
      <CompactSelect
        triggerProps={{prefix: t('Log Level')}}
        triggerLabel={selectValues.length === 0 ? t('Any') : null}
        multiple
        options={severityLevels}
        onChange={setSeverityLevel}
        size="sm"
        value={selectValues.map(v => v.value)}
        disabled={!severityLevels.length}
      />
      <SearchBar
        onChange={setSearchTerm}
        placeholder={t('Search Logs')}
        size="sm"
        query={searchTerm}
        disabled={!logItems?.length}
      />
    </FiltersGrid>
  );
}
