import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {Flex} from '@sentry/scraps/layout';

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
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
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
import type {ModuleName} from 'sentry/views/insights/types';

type Props = {
  allOptionDescription: string;
  allOptionTitle: string;
  onChange: (selectedOption: SelectOption<SelectKey>) => void;
  sortBy: ReleasesSortByOption;
  selectorName?: string;
  selectorValue?: string;
  triggerLabel?: string;
  triggerLabelPrefix?: string;
};

function SingleReleaseSelector({
  allOptionDescription,
  allOptionTitle,
  onChange,
  selectorValue,
  triggerLabel,
  triggerLabelPrefix,
  sortBy,
}: Props) {
  const [searchTerm, setSearchTerm] = useState<string | undefined>(undefined);
  const {data, isLoading} = useReleases(searchTerm, sortBy);
  const {primaryRelease} = useReleaseSelection();

  const options: Array<SelectOption<string> & {count?: number}> = [];

  // Add "All" option as the first option
  options.push({
    value: '',
    label: allOptionTitle,
    details: <div>{allOptionDescription}</div>,
  });

  if (defined(selectorValue)) {
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
    ?.filter(({version}) => primaryRelease !== version)
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
        title: selectorValue,
        prefix: triggerLabelPrefix,
        children: triggerLabel,
        'aria-label': t('Filter Release'),
      }}
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
      onChange={onChange}
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
    <Flex justify="between" gap="md" minWidth="200px">
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
    </Flex>
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

type ReleaseSelectorProps = {
  moduleName: ModuleName;
};

export function ReleaseSelector({moduleName}: ReleaseSelectorProps) {
  const {primaryRelease} = useReleaseSelection();
  const location = useLocation();
  const navigate = useNavigate();
  const {selection} = usePageFilters();
  const organization = useOrganization();

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

  return (
    <StyledPageSelector condensed>
      <SingleReleaseSelector
        allOptionDescription={t('Show data from all releases.')}
        allOptionTitle={t('All')}
        onChange={newValue => {
          trackAnalytics('insights.release.select_release', {
            organization,
            filtered: defined(newValue.value) && newValue.value !== '',
            moduleName,
          });

          const updatedQuery: Record<string, string> = {
            ...location.query,
            primaryRelease: newValue.value as string,
          };

          navigate({
            ...location,
            query: updatedQuery,
          });
        }}
        selectorValue={primaryRelease}
        selectorName={t('Release 1')}
        key="primaryRelease"
        triggerLabelPrefix={primaryRelease ? t('Release') : t('Releases')}
        triggerLabel={primaryTriggerLabelContent}
        sortBy={sortReleasesBy}
      />
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
