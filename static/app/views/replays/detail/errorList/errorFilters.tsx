import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import type {SelectOption} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import type {ErrorFrame} from 'sentry/utils/replays/types';
import type useErrorFilters from 'sentry/views/replays/detail/errorList/useErrorFilters';
import FiltersGrid from 'sentry/views/replays/detail/filtersGrid';

interface Props extends ReturnType<typeof useErrorFilters> {
  errorFrames: undefined | ErrorFrame[];
}

export default function ErrorFilters({
  errorFrames,
  getLevelOptions,
  getProjectOptions,
  searchTerm,
  selectValue,
  setFilters,
  setSearchTerm,
}: Props) {
  const projectOptions = getProjectOptions();
  const levelOptions = getLevelOptions();

  return (
    <FiltersGrid>
      <CompactSelect
        disabled={!projectOptions.length && !levelOptions.length}
        multiple
        onChange={setFilters as (selection: Array<SelectOption<string>>) => void}
        options={[
          {
            label: t('Project'),
            options: projectOptions,
          },
          {
            label: t('Level'),
            options: levelOptions,
          },
        ]}
        size="sm"
        trigger={triggerProps => (
          <OverlayTrigger.Button {...triggerProps} prefix={t('Filter')}>
            {selectValue?.length === 0 ? t('Any') : triggerProps.children}
          </OverlayTrigger.Button>
        )}
        value={selectValue}
      />
      <SearchBar
        size="sm"
        onChange={setSearchTerm}
        placeholder={t('Search Errors')}
        query={searchTerm}
        disabled={!errorFrames?.length}
      />
    </FiltersGrid>
  );
}
