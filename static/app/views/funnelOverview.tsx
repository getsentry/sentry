import {Fragment, useCallback, useMemo, useRef} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {Location, Query} from 'history';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import {SectionHeading} from 'sentry/components/charts/styles';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import EventOrGroupExtraDetails from 'sentry/components/eventOrGroupExtraDetails';
import EventOrGroupHeader from 'sentry/components/eventOrGroupHeader';
import Link from 'sentry/components/links/link';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import checkboxToggle from 'sentry/components/stream/group';
import SelectedGroupStore from 'sentry/stores/selectedGroupStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import {Activity, BaseGroup, Group, GroupStats} from 'sentry/types';
import {Funnel} from 'sentry/types/funnel';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import {TagAndMessageWrapper} from 'sentry/views/issueDetails/unhandledTag';

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
          groups:
            funnelData?.issues
              .map(({issue}) => {
                return issue.id;
              })
              .join(',') ?? '',
        },
      },
    ],
    {
      staleTime: Infinity,
    }
  );

  const listIssues = funnelData?.issues.map(({starts, completes, issue}) => (
    <Wrapper key={issue.id}>
      <div data-test-id="event-issue-header">
        <EventOrGroupHeader data={issue} />
        <EventOrGroupExtraDetails data={issue} />
        <StyledTagAndMessageWrapper size="normal">
          {issue.message && <Message>{issue.message}</Message>}
        </StyledTagAndMessageWrapper>
      </div>
      <EventCountsWrapper>{((100 * completes) / starts).toFixed(2)}%</EventCountsWrapper>
      <EventCountsWrapper>{starts}</EventCountsWrapper>
      <EventCountsWrapper>{completes}</EventCountsWrapper>
      <EventCountsWrapper>
        {eventsCount?.find(({id}) => id === issue.id)?.count}
      </EventCountsWrapper>
    </Wrapper>
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
      <ContentWrapper>
        <IssueListWrapper>
          <IssueList>
            <PanelHeader>
              <div>
                <GridHeader>Issue</GridHeader>
              </div>
              <GridHeader>Completion Rate</GridHeader>
              <GridHeader>Starts</GridHeader>
              <GridHeader>Completes</GridHeader>
              <div>
                <GridHeader>Events</GridHeader>
              </div>
            </PanelHeader>
            <PanelBody>
              {listIssues?.length ? (
                <StyledPanelItem>{listIssues}</StyledPanelItem>
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
const truncateStyles = css`
  overflow: hidden;
  max-width: 100%;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
const StyledPanelItem = styled(PanelItem)`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Title = styled('div')`
  display: inline-flex;
  margin-bottom: ${space(0.25)};
  & em {
    font-size: ${p => p.theme.fontSizeMedium};
    font-style: normal;
    font-weight: 300;
    color: ${p => p.theme.subText};
  }
`;

const TitleWrapper = styled('div')`
  ${p => p.theme.overflowEllipsis};
  display: flex;
  gap: ${space(0.5)};
  min-width: 200px;
`;
const MessageWrapper = styled('span')`
  ${p => p.theme.overflowEllipsis};
  color: ${p => p.theme.textColor};
`;

const EventCountsWrapper = styled('div')`
  display: flex;
  justify-content: flex-end;
  align-self: center;
  width: 60px;
  margin: 0 ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    width: 80px;
  }
`;

const StyledTagAndMessageWrapper = styled(TagAndMessageWrapper)`
  'margin: 0 0 5px;
  line-height: 1.2;
`;

const Message = styled('div')`
  ${truncateStyles};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const LocationWrapper = styled('div')`
  ${truncateStyles};
 'margin: 0 0 5px';
  direction: rtl;
  text-align: left;
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.subText};
  span {
    direction: ltr;
  }
`;
