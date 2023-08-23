import {useState} from 'react';
import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import {SectionHeading} from 'sentry/components/charts/styles';
import DatePageFilter from 'sentry/components/datePageFilter';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import EventOrGroupExtraDetails from 'sentry/components/eventOrGroupExtraDetails';
import EventOrGroupHeader, {GroupLevel} from 'sentry/components/eventOrGroupHeader';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import checkboxToggle from 'sentry/components/stream/group';
import SelectedGroupStore from 'sentry/stores/selectedGroupStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import {
  DateString,
  Group,
  GroupStats,
  Organization,
  PageFilters,
  SelectValue,
} from 'sentry/types';
import {Funnel} from 'sentry/types/funnel';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {TagAndMessageWrapper} from 'sentry/views/issueDetails/unhandledTag';
import IssueListFilters from 'sentry/views/issueList/filters';
import {IssueSearchWithSavedSearches} from 'sentry/views/issueList/issueSearchWithSavedSearches';
import {getVitalDetailTablePoorStatusFunction} from 'sentry/views/performance/vitalDetail/utils';

interface FunnelResponse {
  funnel: Funnel;
  issues: {completes: number; issue: Group; starts: number}[];
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
  const {data: eventsCount} = useApiQuery<GroupStats[]>(
    [
      `/organizations/${organization.slug}/issues-stats/`,
      {
        query: {
          groups: funnelData?.issues.map(({issue}) => {
            return issue.id;
          }),
        },
      },
    ],
    {
      staleTime: Infinity,
    }
  );
  const [sortVal, sortValChange] = useState('completionRate');
  function changeSortVal(newVal) {
    sortValChange(newVal);
  }

  const listIssues = funnelData?.issues
    .sort((a, b) => {
      if (sortVal === 'completionRate') {
        return (100 * b.completes) / b.starts - (100 * a.completes) / a.starts;
      }
      if (sortVal === 'starts') {
        return b.starts - a.starts;
      }
      if (sortVal === 'completes') {
        return b.completes - a.completes;
      }
      if (sortVal === 'events') {
        return (
          Number(eventsCount?.find(({id}) => id === b.issue.id)?.count) -
          Number(eventsCount?.find(({id}) => id === a.issue.id)?.count)
        );
      }
      return 0;
    })
    .map(({starts, completes, issue}) => (
      <WrapGroup key={issue.id}>
        <GroupWrapper data-test-id="event-issue-header">
          <EventOrGroupHeader data={issue} addMargin />
          <EventOrGroupExtraDetails data={issue} />
        </GroupWrapper>
        <EventCountsWrapper style={{gridArea: 'completionRate'}}>
          {((100 * completes) / starts).toFixed(2)}%
        </EventCountsWrapper>
        <EventCountsWrapper style={{gridArea: 'starts'}}>{starts}</EventCountsWrapper>
        <EventCountsWrapper style={{gridArea: 'completes'}}>
          {completes}
        </EventCountsWrapper>
        <EventCountsWrapper style={{gridArea: 'events'}}>
          {eventsCount?.find(({id}) => id === issue.id)?.count}
        </EventCountsWrapper>
      </WrapGroup>
    ));

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

      <SearchContainer>
        <PageFiltersContainer>
          <StyledPageFilterBar>
            <EnvironmentPageFilter />
            <DatePageFilter />
          </StyledPageFilterBar>
        </PageFiltersContainer>
      </SearchContainer>

      <ContentWrapper>
        {listIssues ? (
          <IssueListWrapper>
            <StyledPanelHeader>
              <SelectControl
                placeholder="Sort by..."
                options={[
                  {label: 'Completion Rate', value: 'completionRate'},
                  {label: 'Starts', value: 'starts'},
                  {label: 'Completes', value: 'completes'},
                  {label: 'Events', value: 'events'},
                ]}
                disabled={false}
                value={sortVal}
                onChange={value => changeSortVal(value)}
                singlevalue
                clearindicator={false}
              />
              <GridHeader style={{gridArea: 'issue'}}>Issue</GridHeader>
              <GridHeader style={{gridArea: 'completionRate'}}>
                Completion Rate
              </GridHeader>
              <GridHeader style={{gridArea: 'starts'}}>Starts</GridHeader>
              <GridHeader style={{gridArea: 'completes'}}>Completes</GridHeader>
              <GridHeader style={{gridArea: 'events'}}>Events</GridHeader>
            </StyledPanelHeader>
            <PanelBody>
              {listIssues?.length ? (
                <StyledPanelItem>{listIssues}</StyledPanelItem>
              ) : (
                <StyledEmptyStateWarning>No Related Issues</StyledEmptyStateWarning>
              )}
            </PanelBody>
          </IssueListWrapper>
        ) : (
          <LoadingIndicator />
        )}
        <div>
          {funnelData ? (
            <FunnelInfo>
              <div>
                <SectionHeading>Starting Transaction</SectionHeading>
                <div>
                  <Link
                    to={`/organizations/${organization.slug}/performance/summary/?project=${funnelData.funnel.project}&transaction=${funnelData.funnel.startingTransaction}`}
                  >
                    Transaction {funnelData.funnel.startingTransaction}
                  </Link>
                </div>
              </div>
              <div>
                <SectionHeading>Ending Transaction</SectionHeading>
                <div>
                  <Link
                    to={`/organizations/${organization.slug}/performance/summary/?project=${funnelData.funnel.project}&transaction=${funnelData.funnel.endingTransaction}`}
                  >
                    Transaction {funnelData.funnel.endingTransaction}
                  </Link>
                </div>
              </div>
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
  display: flex;
  flex-direction: column;
  margin-left: ${space(4)};
`;

const FunnelInfo = styled('div')`
  padding: ${space(3)};
`;

const ContentWrapper = styled('div')`
  flex-grow: 1;
  display: grid;
  grid-template-columns: 4fr 1fr;
  height: 100%;
`;

const IssueListWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  background-color: ${p => p.theme.white};
  height: min-content;
  border: 1px solid ${p => p.theme.gray200};
  border-radius: ${p => p.theme.borderRadius};
`;

const GridHeader = styled('h5')`
  color: ${p => p.theme.gray300};
  font-size: 11px;
  margin-bottom: ${space(0.5)};
  text-transform: uppercase;
`;

const WrapGroup = styled('div')`
  width: 100%;
  display: grid;
  grid-template-columns: 4fr 1fr 1fr 1fr 1fr;
  grid-template-areas: 'issue completionRate starts completes events';
  border-bottom: 1px solid ${p => p.theme.gray200};
  &:last-child {
    border-bottom: none;
  }
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

const StyledPanelItem = styled(PanelItem)`
  display: flex;
  flex-direction: column;
  padding: 0;
`;

const EventCountsWrapper = styled('div')`
  display: flex;
  justify-content: flex-end;
  align-self: center;
  width: 60px;
  margin: 0 ${space(2)};
  display: flex;
  flex-direction: column;
`;

const StyledPanelHeader = styled(PanelHeader)`
  display: grid;
  grid-template-areas: 'issue completionRate starts completes events';
  grid-template-columns: 4fr 1fr 1fr 1fr 1fr;
`;

const GroupWrapper = styled('div')`
  position: relative;
  padding: ${space(2)};
  grid-area: issue;
  max-width: 100%; // This ensures the container doesn't grow beyond its grid cell
  overflow: hidden; // Hide overflowed content
  white-space: nowrap; // Prevent content from breaking into the next line
  text-overflow: ellipsis; // Add '...' to show that content is truncated
`;

const SearchContainer = styled('div')`
  display: flex;
  flex-wrap: wrap;
  column-gap: ${space(2)};
  row-gap: ${space(1)};
  width: 100%;
  margin-bottom: ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    flex-direction: column;
  }
`;

const StyledPageFilterBar = styled(PageFilterBar)`
  display: flex;
  flex-basis: content;
  width: 100%;
  max-width: 43rem;
  align-self: flex-start;

  > div > button {
    width: 100%;
  }

  & > * {
    /* Prevent date filter from shrinking below 6.5rem */
    &:nth-last-child(2) {
      min-width: 6.5rem;
    }

    &:last-child {
      min-width: 0;
    }
  }
`;
