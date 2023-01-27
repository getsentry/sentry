import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import Badge from 'sentry/components/badge';
import CompactSelect from 'sentry/components/compactSelect';
import TextOverflow from 'sentry/components/textOverflow';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {IconReleases} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {useReleases} from 'sentry/utils/releases/releasesProvider';

import {DashboardFilterKeys, DashboardFilters} from './types';

type Props = {
  selectedReleases: string[];
  className?: string;
  handleChangeFilter?: (activeFilters: DashboardFilters) => void;
  isDisabled?: boolean;
};

const ALIASED_RELEASES = [
  {
    label: t('Latest Release(s)'),
    value: 'latest',
  },
];

function ReleasesSelectControl({
  handleChangeFilter,
  selectedReleases,
  className,
  isDisabled,
}: Props) {
  const {releases, loading, onSearch} = useReleases();
  const [activeReleases, setActiveReleases] = useState<string[]>(selectedReleases);

  function resetSearch() {
    onSearch('');
  }

  useEffect(() => {
    setActiveReleases(selectedReleases);
  }, [selectedReleases]);

  const triggerLabel = activeReleases.length ? (
    <TextOverflow>{activeReleases[0]} </TextOverflow>
  ) : (
    t('All Releases')
  );

  const activeReleasesSet = new Set(activeReleases);

  return (
    <CompactSelect
      multiple
      isClearable
      isSearchable
      isDisabled={isDisabled}
      isLoading={loading}
      menuTitle={<MenuTitleWrapper>{t('Filter Releases')}</MenuTitleWrapper>}
      className={className}
      onInputChange={debounce(val => {
        onSearch(val);
      }, DEFAULT_DEBOUNCE_DURATION)}
      options={[
        {
          value: '_releases',
          label: t('Sorted by date created'),
          options: [
            ...ALIASED_RELEASES,
            ...activeReleases
              .filter(version => version !== 'latest')
              .map(version => ({
                label: version,
                value: version,
              })),
            ...releases
              .filter(({version}) => !activeReleasesSet.has(version))
              .map(({version}) => ({
                label: version,
                value: version,
              })),
          ],
        },
      ]}
      onChange={opts => setActiveReleases(opts.map(opt => opt.value))}
      onClose={() => {
        resetSearch();
        handleChangeFilter?.({
          [DashboardFilterKeys.RELEASE]: activeReleases,
        });
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

const MenuTitleWrapper = styled('span')`
  display: inline-block;
  padding-top: ${space(0.5)};
  padding-bottom: ${space(0.5)};
`;
