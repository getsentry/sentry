import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button, LinkButton} from 'sentry/components/button';
import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import FunnelItem from 'sentry/components/funnelItem';
import Link from 'sentry/components/links/link';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import Panel from 'sentry/components/panels/panel';
import PanelHeader from 'sentry/components/panels/panelHeader';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import {space} from 'sentry/styles/space';
import type {Funnel as FunnelType} from 'sentry/types/funnel';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import Table from 'sentry/views/discover/table';
import TableView from 'sentry/views/discover/table/tableView';

export default function Funnel() {
  const organization = useOrganization();
  const location = useLocation();
  const api = useApi();
  const {data: funnels, refetch} = useApiQuery<FunnelType[]>(
    [`/organizations/${organization.slug}/funnel/`],
    {
      staleTime: 0,
    }
  );
  return (
    <Wrapper>
      <Header>
        <h2>Funnel</h2>
        <LinkButton
          to={`/organizations/${organization.slug}/funnel/create/`}
          priority="primary"
        >
          New Funnel
        </LinkButton>
      </Header>
      <StyledPanel>
        {funnels?.length ? (
          <Fragment>
            <PanelHeader>Funnel Name</PanelHeader>
            {funnels?.map(funnel => (
              <FunnelItem
                key={funnel.id}
                funnel={funnel}
                organization={organization}
                onDelete={async (funnelSlug: string) => {
                  await api.requestPromise(
                    `/organizations/${organization.slug}/funnel/${funnelSlug}/`,
                    {
                      method: 'DELETE',
                    }
                  );
                  refetch();
                }}
              />
            ))}
          </Fragment>
        ) : null}
      </StyledPanel>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  padding: ${space(3)};
`;

const StyledPanel = styled(Panel)`
  margin-top: ${space(2)};
`;

const Header = styled('div')`
  display: flex;
  justify-content: space-between;
`;
