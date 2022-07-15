import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import Badge from 'sentry/components/badge';
import CompactSelect from 'sentry/components/forms/compactSelect';
import TextOverflow from 'sentry/components/textOverflow';
import {IconReleases} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useReleases} from 'sentry/utils/releases/releasesProvider';

import {DashboardFilter} from './types';

type Props = {
  handleChangeFilter: (activeFilters: Record<DashboardFilter, string[]>) => void;
  selectedReleases: string[];
};

function ReleasesSelectControl({handleChangeFilter, selectedReleases}: Props) {
  const {releases, loading} = useReleases();
  const [activeReleases, setActiveReleases] = useState<string[]>(selectedReleases);

  const triggerLabel = selectedReleases.length ? (
    <TextOverflow>{selectedReleases[0]}</TextOverflow>
  ) : (
    t('All Releases')
  );

  return (
    <CompactSelect
      multiple
      isClearable
      isSearchable
      isLoading={loading}
      menuTitle={t('Filter Releases')}
      options={
        releases.length
          ? releases.map(release => {
              return {
                label: release.shortVersion ?? release.version,
                value: release.version,
              };
            })
          : []
      }
      onChange={opts => setActiveReleases(opts.map(opt => opt.value))}
      onClose={() => {
        handleChangeFilter({[DashboardFilter.RELEASE]: activeReleases});
      }}
      value={activeReleases}
      triggerLabel={
        <Fragment>
          {triggerLabel}
          {selectedReleases.length > 1 && (
            <StyledBadge text={`+${selectedReleases.length - 1}`} />
          )}
        </Fragment>
      }
      triggerProps={{icon: <IconReleases />}}
    />
  );
}

export default ReleasesSelectControl;

const StyledBadge = styled(Badge)`
  flex-shrink: 0;
`;
