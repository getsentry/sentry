import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import isEqual from 'lodash/isEqual';

import {Badge} from '@sentry/scraps/badge';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Container, Grid} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {DateTime} from 'sentry/components/dateTime';
import TextOverflow from 'sentry/components/textOverflow';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {RELEASES_SORT_OPTIONS, ReleasesSortOption} from 'sentry/constants/releases';
import {IconReleases} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';

import {useReleases} from './hooks/useReleases';
import type {DashboardFilters} from './types';
import {DashboardFilterKeys} from './types';

interface ReleasesSelectControlProps {
  selectedReleases: string[];
  sortBy: ReleasesSortOption;
  className?: string;
  handleChangeFilter?: (activeFilters: DashboardFilters) => void;
  id?: string;
  isDisabled?: boolean;
}

const ALIASED_RELEASES = [
  {
    label: t('Latest Release(s)'),
    value: 'latest',
    tooltip: t(
      'The highest version number for Semantic Versioning or the most recent release for commit SHA.'
    ),
  },
];

export function ReleasesSelectControl({
  handleChangeFilter,
  selectedReleases,
  sortBy,
  className,
  isDisabled,
  id,
}: ReleasesSelectControlProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeReleases, setActiveReleases] = useState<string[]>(selectedReleases);
  const [isReleasesDropdownOpen, setIsReleasesDropdownOpen] = useState(false);

  // Event counts are lazy-loaded only when the dropdown is open to reduce API calls
  const {data: releases, isLoading: loading} = useReleases(
    searchTerm,
    sortBy,
    isReleasesDropdownOpen
  );

  function resetSearch() {
    setSearchTerm('');
  }

  useEffect(() => {
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state
    setActiveReleases(selectedReleases);
  }, [selectedReleases]);

  const triggerLabel = activeReleases.length ? (
    <TextOverflow>{activeReleases[0]} </TextOverflow>
  ) : (
    t('All Releases')
  );

  const activeReleasesSet = new Set(activeReleases);

  return (
    <StyledCompactSelect
      multiple
      clearable
      searchable
      id={id}
      disabled={isDisabled}
      loading={loading}
      menuTitle={<MenuTitleWrapper>{t('Filter Releases')}</MenuTitleWrapper>}
      className={className}
      onSearch={debounce(val => {
        setSearchTerm(val);
      }, DEFAULT_DEBOUNCE_DURATION)}
      options={[
        {
          value: '_releases',
          label: tct('Sorted by [sortBy]', {
            sortBy:
              sortBy in RELEASES_SORT_OPTIONS
                ? RELEASES_SORT_OPTIONS[sortBy as keyof typeof RELEASES_SORT_OPTIONS]
                : sortBy,
          }),
          options: [
            ...ALIASED_RELEASES,
            ...activeReleases
              .filter(version => version !== 'latest')
              .map(version => {
                // Find the release in the releases array to get dateCreated and count
                const release = releases.find(r => r.version === version);
                return {
                  label: version,
                  value: version,
                  details: (
                    <LabelDetails
                      eventCount={release?.count}
                      dateCreated={release?.dateCreated}
                    />
                  ),
                };
              }),
            ...releases
              .filter(({version}) => !activeReleasesSet.has(version))
              .map(({version, dateCreated, count}) => {
                return {
                  label: version,
                  value: version,
                  details: <LabelDetails eventCount={count} dateCreated={dateCreated} />,
                };
              }),
          ],
        },
      ]}
      onChange={opts => setActiveReleases(opts.map(opt => opt.value as string))}
      onOpenChange={setIsReleasesDropdownOpen}
      onClose={() => {
        resetSearch();
        if (!isEqual(activeReleases, selectedReleases)) {
          handleChangeFilter?.({
            [DashboardFilterKeys.RELEASE]: activeReleases,
          });
        }
      }}
      value={activeReleases}
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps} icon={<IconReleases />}>
          <ButtonLabelWrapper>
            {triggerLabel}{' '}
            {activeReleases.length > 1 && (
              <StyledBadge variant="muted">{`+${activeReleases.length - 1}`}</StyledBadge>
            )}
          </ButtonLabelWrapper>
        </OverlayTrigger.Button>
      )}
    />
  );
}

type LabelDetailsProps = {
  dateCreated?: string;
  eventCount?: number;
};

function LabelDetails(props: LabelDetailsProps) {
  return (
    <Grid columns="repeat(2, 1fr)" gap="sm" minWidth="200px">
      <Container>
        {defined(props.eventCount) && tn('%s event', '%s events', props.eventCount)}
      </Container>

      <Container justifySelf="right">
        {defined(props.dateCreated) && (
          <DateTime dateOnly year date={props.dateCreated} />
        )}
      </Container>
    </Grid>
  );
}

const StyledBadge = styled(Badge)`
  flex-shrink: 0;
`;

const StyledCompactSelect = styled(CompactSelect)`
  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    max-width: 300px;
  }
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
