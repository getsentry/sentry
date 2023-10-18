import styled from '@emotion/styled';
import type {Location} from 'history';

import ButtonBar from 'sentry/components/buttonBar';
import {CompactSelect} from 'sentry/components/compactSelect';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import SearchBar from 'sentry/components/searchBar';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import TeamFilter from './list/rules/teamFilter';
import {DatasetOption, getQueryDataset, getQueryStatus, getTeamParams} from './utils';

interface Props {
  location: Location<any>;
  onChangeFilter: (activeFilters: string[]) => void;
  onChangeSearch: (query: string) => void;
  hasStatusFilters?: boolean;
  onChangeDataset?: (dataset: DatasetOption) => void;
  onChangeStatus?: (status: string) => void;
}

function FilterBar({
  location,
  onChangeSearch,
  onChangeFilter,
  onChangeStatus,
  onChangeDataset,
  hasStatusFilters,
}: Props) {
  const selectedTeams = getTeamParams(location.query.team);
  const selectedStatus = getQueryStatus(location.query.status);
  const selectedDataset = getQueryDataset(location.query.dataset);

  return (
    <Wrapper>
      <FilterButtons gap={1.5}>
        <TeamFilter selectedTeams={selectedTeams} handleChangeFilter={onChangeFilter} />
        <ProjectPageFilter />
        {hasStatusFilters && onChangeStatus && (
          <CompactSelect
            triggerProps={{
              prefix: t('Status'),
            }}
            options={[
              {
                value: 'all',
                label: t('All'),
              },
              {
                value: 'open',
                label: t('Active'),
              },
              {
                value: 'closed',
                label: t('Inactive'),
              },
            ]}
            value={selectedStatus}
            onChange={({value}) => onChangeStatus(value)}
          />
        )}
        {onChangeDataset && (
          <SegmentedControlWrapper>
            <SegmentedControl<DatasetOption>
              aria-label={t('Alert type')}
              value={selectedDataset}
              onChange={onChangeDataset}
            >
              <SegmentedControl.Item key={DatasetOption.ALL}>
                {t('All')}
              </SegmentedControl.Item>
              <SegmentedControl.Item key={DatasetOption.ERRORS}>
                {t('Errors')}
              </SegmentedControl.Item>
              <SegmentedControl.Item key={DatasetOption.SESSIONS}>
                {t('Sessions')}
              </SegmentedControl.Item>
              <SegmentedControl.Item key={DatasetOption.PERFORMANCE}>
                {t('Performance')}
              </SegmentedControl.Item>
            </SegmentedControl>
          </SegmentedControlWrapper>
        )}
      </FilterButtons>
      <SearchBar
        placeholder={t('Search by name')}
        query={location.query?.name}
        onSearch={onChangeSearch}
      />
    </Wrapper>
  );
}

export default FilterBar;

const Wrapper = styled('div')`
  display: grid;
  gap: ${space(1.5)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: min-content 1fr;
  }
`;

const FilterButtons = styled(ButtonBar)`
  @media (max-width: ${p => p.theme.breakpoints.large}) {
    display: flex;
    align-items: flex-start;
    gap: ${space(1.5)};
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    display: grid;
    grid-auto-columns: minmax(auto, 300px);
  }
`;

const SegmentedControlWrapper = styled('div')`
  width: max-content;
`;
