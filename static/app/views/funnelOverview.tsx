import styled from '@emotion/styled';

import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import {space} from 'sentry/styles/space';
import {Funnel} from 'sentry/types/funnel';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';

interface FunnelResponse {
  funnel: Funnel;
  totalCompletions: number;
  totalStarts: number;
}

export default function FunnelOverview() {
  const organization = useOrganization();
  const router = useRouter();
  const location = useLocation();
  const {data: funnelData} = useApiQuery<FunnelResponse>(
    [
      `/organizations/${organization.slug}/funnel/${router.params.funnelSlug}/`,
      {
        query: location.query,
      },
    ],
    {
      staleTime: Infinity,
    }
  );
  return (
    <Wrapper>
      <h1>Funnel</h1>
      <PageFiltersContainer>
        <PageFilterBar condensed>
          <ProjectPageFilter />
          <EnvironmentPageFilter />
          <DatePageFilter alignDropdown="left" />
        </PageFilterBar>
      </PageFiltersContainer>
      {funnelData ? (
        <FunnelInfo>
          <h3>{funnelData?.funnel.name}</h3>
          <div>Total Starts: {funnelData.totalStarts}</div>
          <div>Total Completions: {funnelData.totalCompletions}</div>
          {funnelData.totalStarts > 0 ? (
            <div>
              Rate: {(100 * funnelData.totalCompletions) / funnelData.totalStarts}{' '}
            </div>
          ) : null}
        </FunnelInfo>
      ) : null}
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  padding: ${space(3)};
`;

const FunnelInfo = styled('div')`
  margin-top: ${space(3)};
`;
