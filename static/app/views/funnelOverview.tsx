import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import {SectionHeading} from 'sentry/components/charts/styles';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
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
      <HeaderWrapper>
        <Breadcrumbs
          crumbs={[
            {
              label: 'Funnels',
              to: `/organizations/${organization.slug}/funnel/`,
            },
            {label: funnelData?.funnel.name},
          ]}
        />
        <h2>Funnel {funnelData?.funnel.name}</h2>
      </HeaderWrapper>
      <ContentWrapper>
        <IssueListWrapper>
          <IssueList>
            <PanelHeader>
              <div>
                <GridHeader>Issue</GridHeader>
              </div>
              <div>
                <GridHeader>Events</GridHeader>
              </div>
            </PanelHeader>
            <PanelBody>
              {listissues?.length ? (
                <ul>to fill in</ul>
              ) : (
                <StyledEmptyStateWarning>No Related Issues</StyledEmptyStateWarning>
              )}
              <Grid />
            </PanelBody>
          </IssueList>
        </IssueListWrapper>
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

const Wrapper = styled('main')`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
`;

const FunnelInfo = styled('div')`
  border-top: 1px solid ${p => p.theme.gray200};
  padding: ${space(3)};
`;

const ContentWrapper = styled('div')`
  flex-grow: 1;
  display: grid;
  grid-template-columns: 4fr 1fr;
  background-color: ${p => p.theme.white};
  height: 100%;
`;

const IssueList = styled(Panel)`
  margin: ${space(2)};
`;

const IssueListWrapper = styled('div')`
  border: 1px solid ${p => p.theme.gray200};
`;

const GridHeader = styled('h5')`
  color: ${p => p.theme.gray300};
  font-size: 11px;
  margin-bottom: ${space(0.5)};
  text-transform: uppercase;
`;

const Grid = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${space(2)};
`;

const StyledEmptyStateWarning = styled(EmptyStateWarning)`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  width: 100%;
`;

const HeaderWrapper = styled('div')`
  padding: ${space(3)};
`;
