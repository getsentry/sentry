import styled from '@emotion/styled';
import type {Location} from 'history';

import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import SearchBar from 'sentry/components/searchBar';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import TeamFilter from './list/rules/teamFilter';
import {CombinedAlertType} from './types';
import {getQueryAlertType, getQueryStatus, getTeamParams} from './utils';

interface Props {
  location: Location<any>;
  onChangeFilter: (activeFilters: string[]) => void;
  onChangeSearch: (query: string) => void;
  hasStatusFilters?: boolean;
  hasTypeFilter?: boolean;
  onChangeAlertType?: (types: CombinedAlertType[]) => void;
  onChangeStatus?: (status: string) => void;
}

function FilterBar({
  location,
  onChangeSearch,
  onChangeFilter,
  onChangeStatus,
  onChangeAlertType,
  hasStatusFilters,
  hasTypeFilter,
}: Props) {
  const selectedTeams = getTeamParams(location.query.team);
  const selectedStatus = getQueryStatus(location.query.status);
  const selectedAlertTypes = getQueryAlertType(location.query.alertType);

  return (
    <Wrapper>
      <FilterButtons gap="lg">
        <TeamFilter selectedTeams={selectedTeams} handleChangeFilter={onChangeFilter} />
        <ProjectPageFilter />
        {hasTypeFilter && (
          <CompactSelect
            multiple
            trigger={triggerProps => (
              <OverlayTrigger.Button {...triggerProps} prefix={t('Alert Type')}>
                {selectedAlertTypes.length === 0 ? t('All') : triggerProps.children}
              </OverlayTrigger.Button>
            )}
            menuFooter={
              <ButtonBar>
                <LinkButton size="xs" icon={<IconOpen />} to="/insights/crons/">
                  {t('Crons Overview')}
                </LinkButton>
                <LinkButton size="xs" icon={<IconOpen />} to="/insights/uptime/">
                  {t('Uptime Overview')}
                </LinkButton>
              </ButtonBar>
            }
            options={[
              {
                value: CombinedAlertType.ISSUE,
                label: t('Issue Alerts'),
              },
              {
                value: CombinedAlertType.METRIC,
                label: t('Metric Alerts'),
              },
              {
                value: CombinedAlertType.UPTIME,
                label: t('Uptime Monitors'),
              },
              {
                value: CombinedAlertType.CRONS,
                label: t('Cron Monitors'),
              },
            ]}
            value={selectedAlertTypes}
            onChange={value => onChangeAlertType?.(value.map(v => v.value))}
          />
        )}
        {hasStatusFilters && onChangeStatus && (
          <CompactSelect
            trigger={triggerProps => (
              <OverlayTrigger.Button {...triggerProps} prefix={t('Status')} />
            )}
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

  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    grid-template-columns: min-content 1fr;
  }
`;

const FilterButtons = styled(ButtonBar)`
  @media (max-width: ${p => p.theme.breakpoints.lg}) {
    display: flex;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: ${space(1.5)};
  }

  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    display: grid;
    grid-auto-columns: max-content;
  }
`;
