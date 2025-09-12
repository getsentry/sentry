import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import type {SelectKey, SelectOption} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {DateTime} from 'sentry/components/dateTime';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {ReleasesSortOption} from 'sentry/constants/releases';
import {IconReleases} from 'sentry/icons/iconReleases';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  ReleasesSort,
  SORT_BY_OPTIONS,
  type ReleasesSortByOption,
} from 'sentry/views/insights/common/components/releasesSort';
import {
  useReleases,
  useReleaseSelection,
} from 'sentry/views/insights/common/queries/useReleases';
import {formatVersionAndCenterTruncate} from 'sentry/views/insights/common/utils/formatVersionAndCenterTruncate';

export const PRIMARY_RELEASE_ALIAS = 'R1';
export const SECONDARY_RELEASE_ALIAS = 'R2';

type Props = {
  onChange: (selectedOption: SelectOption<string>) => void;
  selectorKey: string;
  sortBy: ReleasesSortByOption;
  selectorName?: string;
  selectorValue?: string;
  triggerLabel?: string;
  triggerLabelPrefix?: string;
};

function ReleaseSelector({
  onChange,
  selectorKey,
  selectorValue,
  triggerLabel,
  triggerLabelPrefix,
  sortBy,
}: Props) {
  const [searchTerm, setSearchTerm] = useState<string | undefined>(undefined);
  const {data, isLoading} = useReleases(searchTerm, sortBy);
  const {primaryRelease, secondaryRelease} = useReleaseSelection();

  const options: Array<SelectOption<string> & {count?: number}> = [];

  // Add "All" option as the first option
  options.push({
    value: '',
    label: selectorKey === 'primaryRelease' ? t('All') : t('None'),
    details: (
      <div>
        {selectorKey === 'primaryRelease' ? t('Show data from all releases.') : ''}
      </div>
    ),
  });

  if (defined(selectorValue) && selectorValue !== '') {
    const index = data?.findIndex(({version}) => version === selectorValue);
    const selectedRelease = defined(index) ? data?.[index] : undefined;
    let selectedReleaseSessionCount: number | undefined = undefined;
    let selectedReleaseDateCreated: string | undefined = undefined;
    if (defined(selectedRelease)) {
      selectedReleaseSessionCount = selectedRelease.count;
      selectedReleaseDateCreated = selectedRelease.dateCreated;
    }

    options.push({
      value: selectorValue,
      count: selectedReleaseSessionCount,
      label: selectorValue,
      details: (
        <LabelDetails
          screenCount={selectedReleaseSessionCount}
          dateCreated={selectedReleaseDateCreated}
        />
      ),
    });
  }

  data
    ?.filter(({version}) => ![primaryRelease, secondaryRelease].includes(version))
    .forEach(release => {
      const option = {
        value: release.version,
        label: release.version,
        count: release.count,
        details: (
          <LabelDetails screenCount={release.count} dateCreated={release.dateCreated} />
        ),
      };
      options.push(option);
    });

  return (
    <StyledCompactSelect
      triggerProps={{
        icon: <IconReleases />,
        title: triggerLabel,
        prefix: triggerLabelPrefix,
      }}
      triggerLabel={triggerLabel}
      menuTitle={t('Filter Release')}
      loading={isLoading}
      searchable
      value={selectorValue || ''}
      options={[
        {
          value: '_all_option',
          options: options.slice(0, 1), // "All" option
        },
        {
          value: '_selected_release',
          // We do this because the selected/default release might not be sorted,
          // but instead could have been added to the top of options list.
          options: selectorValue && selectorValue !== '' ? options.slice(1, 2) : [],
        },
        {
          value: '_releases',
          label: tct('Sorted by [sortBy]', {
            sortBy: SORT_BY_OPTIONS[sortBy].label,
          }),
          // Display other releases sorted by the selected option
          options:
            selectorValue && selectorValue !== '' ? options.slice(2) : options.slice(1),
        },
      ]}
      onSearch={debounce(val => {
        setSearchTerm(val);
      }, DEFAULT_DEBOUNCE_DURATION)}
      onChange={onChange as (selectedOption: SelectOption<SelectKey>) => void}
      onClose={() => {
        setSearchTerm(undefined);
      }}
    />
  );
}

type LabelDetailsProps = {
  dateCreated?: string;
  screenCount?: number;
};

function LabelDetails(props: LabelDetailsProps) {
  return (
    <DetailsContainer>
      <div>
        {defined(props.screenCount)
          ? tn('%s event', '%s events', props.screenCount)
          : t('No screens')}
      </div>
      <div>
        {defined(props.dateCreated) && (
          <DateTime dateOnly year date={props.dateCreated} />
        )}
      </div>
    </DetailsContainer>
  );
}

function getReleasesSortBy(
  sort: ReleasesSortByOption,
  environments: string[]
): ReleasesSortByOption {
  // Require 1 environment for date adopted
  if (sort === ReleasesSortOption.ADOPTION && environments.length !== 1) {
    return ReleasesSortOption.DATE;
  }

  if (sort in SORT_BY_OPTIONS) {
    return sort;
  }

  // We could give a visual feedback to the user, saying that the sort by is invalid but
  // since this UI will be refactored, maybe we just don't do anything now.
  // This is the same fallback as the one used in static/app/views/insights/common/queries/useReleases.tsx.
  return ReleasesSortOption.DATE;
}

type ReleaseComparisonSelectorProps = {
  primaryOnly?: boolean;
};

export function ReleaseComparisonSelector({
  primaryOnly = false,
}: ReleaseComparisonSelectorProps) {
  const {primaryRelease, secondaryRelease} = useReleaseSelection();
  const location = useLocation();
  const navigate = useNavigate();
  const {selection} = usePageFilters();

  const [localStoragedReleaseBy, setLocalStoragedReleaseBy] =
    useLocalStorageState<ReleasesSortByOption>(
      'insightsReleasesSortBy',
      ReleasesSortOption.DATE
    );

  const urlStoragedReleaseBy = decodeScalar(
    location.query.sortReleasesBy
  ) as ReleasesSortByOption;

  useEffect(() => {
    if (urlStoragedReleaseBy === localStoragedReleaseBy) {
      return;
    }

    // this is useful in case the user shares the url with another user
    // and the user has a different sort by in their local storage
    if (!urlStoragedReleaseBy) {
      navigate(
        {
          ...location,
          query: {
            ...location.query,
            sortReleasesBy: localStoragedReleaseBy,
          },
        },
        {replace: true}
      );
      return;
    }

    setLocalStoragedReleaseBy(urlStoragedReleaseBy);
  }, [
    urlStoragedReleaseBy,
    localStoragedReleaseBy,
    setLocalStoragedReleaseBy,
    location,
    navigate,
  ]);

  const sortReleasesBy = getReleasesSortBy(
    localStoragedReleaseBy,
    selection.environments
  );

  const primaryTriggerLabelContent = primaryRelease
    ? formatVersionAndCenterTruncate(primaryRelease, 16)
    : 'All';

  const secondaryTriggerLabelContent = secondaryRelease
    ? formatVersionAndCenterTruncate(secondaryRelease, 16)
    : 'None';

  return (
    <StyledPageSelector condensed>
      <ReleaseSelector
        onChange={newValue => {
          const updatedQuery: Record<string, string> = {
            ...location.query,
            primaryRelease: newValue.value,
          };

          if (newValue.value === '') {
            delete updatedQuery.secondaryRelease;
          }
          navigate({
            ...location,
            query: updatedQuery,
          });
        }}
        selectorKey="primaryRelease"
        selectorValue={primaryRelease}
        selectorName={t('Release 1')}
        key="primaryRelease"
        triggerLabelPrefix={
          secondaryRelease
            ? PRIMARY_RELEASE_ALIAS
            : primaryRelease
              ? t('Release')
              : t('Releases')
        }
        triggerLabel={primaryTriggerLabelContent}
        sortBy={sortReleasesBy}
      />
      {primaryOnly === false && primaryRelease && (
        <ReleaseSelector
          onChange={newValue => {
            const updatedQuery: Record<string, string> = {
              ...location.query,
              secondaryRelease: newValue.value,
            };

            navigate({
              ...location,
              query: updatedQuery,
            });
          }}
          selectorKey="secondaryRelease"
          selectorName={t('Release 2')}
          selectorValue={secondaryRelease}
          key="secondaryRelease"
          triggerLabelPrefix={secondaryRelease ? SECONDARY_RELEASE_ALIAS : t('Compare')}
          triggerLabel={secondaryTriggerLabelContent}
          sortBy={sortReleasesBy}
        />
      )}
      <ReleasesSort
        sortBy={sortReleasesBy}
        environments={selection.environments}
        onChange={value =>
          navigate({
            ...location,
            query: {
              ...location.query,
              sortReleasesBy: value,
            },
          })
        }
      />
    </StyledPageSelector>
  );
}

const StyledCompactSelect = styled(CompactSelect)`
  @media (min-width: ${p => p.theme.breakpoints.md}) {
    max-width: 275px;
  }
`;

const StyledPageSelector = styled(PageFilterBar)`
  & > * {
    min-width: 135px;
    &:last-child {
      min-width: auto;
      > button[aria-haspopup] {
        padding-right: ${space(1.5)};
      }
    }
  }
`;

const DetailsContainer = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  gap: ${space(1)};
  min-width: 200px;
`;
