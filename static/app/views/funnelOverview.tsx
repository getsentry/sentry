import styled from '@emotion/styled';

import {SectionHeading} from 'sentry/components/charts/styles';
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
  issues: any[];
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
  const listissues = funnelData?.issues.map(issue => <li key={issue}>{issue}</li>);

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
      <Title>{funnelData?.funnel.name}</Title>
      <ContentWrapper>
        <ul>{listissues}</ul>
        <div>
          {funnelData ? (
            <FunnelInfo>
              <div>
                <SectionHeading>Total Starts</SectionHeading>
                <div>{funnelData.totalStarts}</div>
              </div>
              <div>
                <SectionHeading>Total Completions</SectionHeading>
                <div>{funnelData.totalCompletions}</div>
              </div>
              {funnelData.totalStarts > 0 ? (
                <div>
                  <SectionHeading>Completion Rate</SectionHeading>
                  <div>
                    {(
                      (100 * funnelData.totalCompletions) /
                      funnelData.totalStarts
                    ).toFixed(2)}
                    %
                  </div>
                </div>
              ) : null}
            </FunnelInfo>
          ) : null}
        </div>
      </ContentWrapper>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  padding: ${space(3)};
`;

const FunnelInfo = styled('div')`
  margin-top: ${space(3)};
`;

const ContentWrapper = styled('div')`
  display: grid;
  grid-template-columns: 4fr 1fr;
  grid-gap: ${space(3)};
`;

const Title = styled('h3')`
  margin-top: ${space(3)};
`;
