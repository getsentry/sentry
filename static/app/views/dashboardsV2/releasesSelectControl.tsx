import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import Badge from 'sentry/components/badge';
import FeatureBadge from 'sentry/components/featureBadge';
import CompactSelect from 'sentry/components/forms/compactSelect';
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

  return (
    <CompactSelect
      multiple
      isClearable
      isSearchable
      isDisabled={isDisabled}
      isLoading={loading}
      menuTitle={
        <MenuTitleWrapper>
          {t('Filter Releases')}
          <FeatureBadge type="beta" />
        </MenuTitleWrapper>
      }
      className={className}
      onInputChange={debounce(val => {
        onSearch(val);
      }, DEFAULT_DEBOUNCE_DURATION)}
      options={[
        {
          value: '_releases',
          label: t('Sorted by date created'),
          options: releases.length
            ? [
                ...ALIASED_RELEASES,
                ...releases.map(release => {
                  return {
                    label: release.shortVersion ?? release.version,
                    value: release.version,
                  };
                }),
              ]
            : [],
        },
      ]}
      onChange={opts => setActiveReleases(opts.map(opt => opt.value))}
      onClose={() => {
        resetSearch();
        const activeReleasesVersions = new Set(activeReleases);

        const activeReleasesById = releases
          .filter(release => activeReleasesVersions.has(release.version))
          .map(release => release.id);

        if (activeReleasesVersions.has('latest')) {
          activeReleasesById.push('latest');
        }

        handleChangeFilter?.({
          [DashboardFilterKeys.RELEASE]: activeReleases,
          [DashboardFilterKeys.RELEASE_ID]: activeReleasesById,
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
