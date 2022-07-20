import {useState} from 'react';
import styled from '@emotion/styled';

import Badge from 'sentry/components/badge';
import CompactSelect from 'sentry/components/forms/compactSelect';
import TextOverflow from 'sentry/components/textOverflow';
import {IconReleases} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useReleases} from 'sentry/utils/releases/releasesProvider';

import {DashboardFilterKeys, DashboardFilters} from './types';

type Props = {
  selectedReleases: string[];
  className?: string;
  handleChangeFilter?: (activeFilters: DashboardFilters) => void;
  isDisabled?: boolean;
};

function ReleasesSelectControl({
  handleChangeFilter,
  selectedReleases,
  className,
  isDisabled,
}: Props) {
  const {releases, loading} = useReleases();
  const [activeReleases, setActiveReleases] = useState<string[]>(selectedReleases);

  const triggerLabel = activeReleases.length ? (
    <TextOverflow>{activeReleases[0]} </TextOverflow>
  ) : (
    t('All Releases')
  );

  return (
    <CompactSelect
      multiple
      isClearable
      isSearchable
      isDisabled={isDisabled}
      isLoading={loading}
      menuTitle={t('Filter Releases')}
      className={className}
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
        handleChangeFilter?.({[DashboardFilterKeys.RELEASE]: activeReleases});
      }}
      value={activeReleases}
      triggerLabel={
        <ButtonLabelWrapper>
          {triggerLabel}{' '}
          {activeReleases.length > 1 && (
            <StyledBadge text={`+${activeReleases.length - 1}`} />
          )}
        </ButtonLabelWrapper>
      }
      triggerProps={{icon: <IconReleases />}}
    />
  );
}

export default ReleasesSelectControl;

const StyledBadge = styled(Badge)`
  flex-shrink: 0;
`;

const ButtonLabelWrapper = styled('span')`
  width: 100%;
  text-align: left;
  align-items: center;
  display: inline-grid;
  grid-template-columns: 1fr auto;
`;
