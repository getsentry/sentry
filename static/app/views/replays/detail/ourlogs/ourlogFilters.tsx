import styled from '@emotion/styled';

import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import FiltersGrid from 'sentry/views/replays/detail/filtersGrid';
import {OpenInLogsButton} from 'sentry/views/replays/detail/ourlogs/openInLogsButton';
import type useOurLogFilters from 'sentry/views/replays/detail/ourlogs/useOurLogFilters';

type Props = {
  logItems: OurLogsResponseItem[];
  replayId?: string;
} & ReturnType<typeof useOurLogFilters>;

export function OurLogFilters({
  logItems,
  replayId,
  getSeverityLevels,
  searchTerm,
  selectValues,
  setSeverityLevel,
  setSearchTerm,
}: Props) {
  const severityLevels = getSeverityLevels();

  return (
    <StyledFiltersGrid>
      <CompactSelect
        trigger={triggerProps => (
          <OverlayTrigger.Button {...triggerProps} prefix={t('Log Level')}>
            {selectValues.length === 0 ? t('Any') : triggerProps.children}
          </OverlayTrigger.Button>
        )}
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
      <OpenInLogsButton searchTerm={searchTerm} replayId={replayId} />
    </StyledFiltersGrid>
  );
}

const StyledFiltersGrid = styled(FiltersGrid)`
  grid-template-columns: max-content 1fr min-content;
`;
