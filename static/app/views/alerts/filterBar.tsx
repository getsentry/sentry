import styled from '@emotion/styled';
import type {Location} from 'history';

import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Flex, Grid} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {CreateAlertButton} from 'sentry/components/createAlertButton';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {SearchBar} from 'sentry/components/searchBar';
import {TeamFilter} from 'sentry/components/teamFilter';
import {t} from 'sentry/locale';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {useOrganization} from 'sentry/utils/useOrganization';

import {getQueryStatus, getTeamParams} from './utils';

interface Props {
  location: Location<any>;
  onChangeFilter: (activeFilters: string[]) => void;
  onChangeSearch: (query: string) => void;
  hasStatusFilters?: boolean;
  onChangeStatus?: (status: string) => void;
}

export function FilterBar({
  location,
  onChangeSearch,
  onChangeFilter,
  onChangeStatus,
  hasStatusFilters,
}: Props) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const selectedTeams = getTeamParams(location.query.team);
  const selectedStatus = getQueryStatus(location.query.status);

  return (
    <Grid columns={{zero: '1fr', '4xl': 'min-content 1fr'}} gap="lg" marginBottom="xl">
      <Flex
        gap="lg"
        align={{zero: 'start', '4xl': 'center'}}
        wrap={{zero: 'wrap', '4xl': 'nowrap'}}
        width={{zero: '100%', '4xl': 'max-content'}}
      >
        <TeamFilter selectedTeams={selectedTeams} handleChangeFilter={onChangeFilter} />
        <ProjectPageFilter />
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
      </Flex>
      <Grid minWidth={0} width="100%" gap="md" align="center" columns="1fr min-content">
        <Flex minWidth={0} width="100%">
          <FullWidthSearchBar
            placeholder={t('Search by name')}
            query={location.query?.name}
            onSearch={onChangeSearch}
            width="100%"
          />
        </Flex>
        <CreateAlertButton
          organization={organization}
          iconProps={{size: 'sm'}}
          variant="primary"
          referrer="alert_stream"
          projectSlug={
            selection.projects.length === 1
              ? ProjectsStore.getById(`${selection.projects[0]}`)?.slug
              : undefined
          }
        >
          {t('Create Alert')}
        </CreateAlertButton>
      </Grid>
    </Grid>
  );
}

const FullWidthSearchBar = styled(SearchBar)`
  width: 100%;

  form {
    width: 100%;
  }
`;
