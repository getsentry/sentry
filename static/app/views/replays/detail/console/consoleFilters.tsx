import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import type useConsoleFilters from 'sentry/views/replays/detail/console/useConsoleFilters';
import FiltersGrid from 'sentry/views/replays/detail/filtersGrid';

type Props = {
  frames: undefined | unknown[];
} & ReturnType<typeof useConsoleFilters>;

function Filters({
  frames,
  getLogLevels,
  logLevel,
  searchTerm,
  setLogLevel,
  setSearchTerm,
}: Props) {
  const logLevels = getLogLevels();
  return (
    <FiltersGrid>
      <CompactSelect
        trigger={triggerProps => (
          <OverlayTrigger.Button {...triggerProps} prefix={t('Log Level')}>
            {logLevel.length === 0 ? t('Any') : triggerProps.children}
          </OverlayTrigger.Button>
        )}
        multiple
        options={logLevels}
        onChange={selected => setLogLevel(selected.map(_ => _.value))}
        size="sm"
        value={logLevel}
        disabled={!logLevels.length}
      />
      <SearchBar
        onChange={setSearchTerm}
        placeholder={t('Search Console Logs')}
        size="sm"
        query={searchTerm}
        disabled={!frames?.length}
      />
    </FiltersGrid>
  );
}

export default Filters;
