import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import isEqual from 'lodash/isEqual';

import {SelectTrigger} from '@sentry/scraps/compactSelect/trigger';
import {Flex} from '@sentry/scraps/layout';

import {Badge} from 'sentry/components/core/badge';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {DateTime} from 'sentry/components/dateTime';
import TextOverflow from 'sentry/components/textOverflow';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {IconReleases} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {
  SORT_BY_OPTIONS,
  type ReleasesSortByOption,
} from 'sentry/views/insights/common/components/releasesSort';

import {useReleases} from './hooks/useReleases';
import type {DashboardFilters} from './types';
import {DashboardFilterKeys} from './types';

type Props = {
  selectedReleases: string[];
  sortBy: ReleasesSortByOption;
  className?: string;
  handleChangeFilter?: (activeFilters: DashboardFilters) => void;
  id?: string;
  isDisabled?: boolean;
};

const ALIASED_RELEASES = [
  {
    label: t('Latest Release(s)'),
    value: 'latest',
    tooltip: t(
      'The highest version number for Semantic Versioning or the most recent release for commit SHA.'
    ),
  },
];

type LabelDetailsProps = {
  dateCreated?: string;
  eventCount?: number;
};

function LabelDetails(props: LabelDetailsProps) {
  return (
    <Flex justify="space-between" gap="sm" style={{minWidth: 200}}>
      <div>
        {defined(props.eventCount)
          ? tn('%s event', '%s events', props.eventCount)
          : t('No events')}
      </div>
      <div>
        {defined(props.dateCreated) && (
          <DateTime dateOnly year date={props.dateCreated} />
        )}
      </div>
    </Flex>
  );
}

function ReleasesSelectControl({
  handleChangeFilter,
  selectedReleases,
  sortBy,
  className,
  isDisabled,
  id,
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeReleases, setActiveReleases] = useState<string[]>(selectedReleases);

  const {data: releases, isLoading: loading} = useReleases(searchTerm, sortBy);

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
            sortBy: SORT_BY_OPTIONS[sortBy].label,
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
        <SelectTrigger.Button {...triggerProps} icon={<IconReleases />}>
          <ButtonLabelWrapper>
            {triggerLabel}{' '}
            {activeReleases.length > 1 && (
              <StyledBadge variant="muted">{`+${activeReleases.length - 1}`}</StyledBadge>
            )}
          </ButtonLabelWrapper>
        </SelectTrigger.Button>
      )}
    />
  );
}

export default ReleasesSelectControl;

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
