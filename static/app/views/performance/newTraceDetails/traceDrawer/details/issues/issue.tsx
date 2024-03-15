import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import Count from 'sentry/components/count';
import EventOrGroupExtraDetails from 'sentry/components/eventOrGroupExtraDetails';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PanelItem from 'sentry/components/panels/panelItem';
import {IconWrapper} from 'sentry/components/sidebarSection';
import GroupChart from 'sentry/components/stream/groupChart';
import {IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group, Organization} from 'sentry/types';
import type {TraceErrorOrIssue} from 'sentry/utils/performance/quickTrace/types';
import {useApiQuery} from 'sentry/utils/queryClient';

import IssueSummary from './issueSummary';

type Props = {
  event_id: string;
  issue: TraceErrorOrIssue;
  organization: Organization;
};

function Issue(props: Props) {
  const {
    isLoading,
    data: fetchedIssue,
    isError,
  } = useApiQuery<Group>(
    [
      `/issues/${props.issue.issue_id}/`,
      {
        query: {
          collapse: 'release',
          expand: 'inbox',
        },
      },
    ],
    {
      staleTime: 2 * 60 * 1000,
    }
  );

  return isLoading ? (
    <StyledLoadingIndicatorWrapper>
      <LoadingIndicator size={24} mini />
    </StyledLoadingIndicatorWrapper>
  ) : fetchedIssue ? (
    <StyledPanelItem>
      <IssueSummaryWrapper>
        <IssueSummary
          data={fetchedIssue}
          organization={props.organization}
          event_id={props.event_id}
        />
        <EventOrGroupExtraDetails data={fetchedIssue} />
      </IssueSummaryWrapper>
      <ChartWrapper>
        <GroupChart
          statsPeriod={'24h'}
          data={fetchedIssue}
          showSecondaryPoints
          showMarkLine
        />
      </ChartWrapper>
      <ColumnWrapper>
        <PrimaryCount
          value={fetchedIssue.filtered ? fetchedIssue.filtered.count : fetchedIssue.count}
        />
      </ColumnWrapper>
      <ColumnWrapper>
        <PrimaryCount
          value={
            fetchedIssue.filtered
              ? fetchedIssue.filtered.userCount
              : fetchedIssue.userCount
          }
        />
      </ColumnWrapper>
      <ColumnWrapper>
        {fetchedIssue.assignedTo ? (
          <ActorAvatar actor={fetchedIssue.assignedTo} hasTooltip size={24} />
        ) : (
          <StyledIconWrapper>
            <IconUser size="md" />
          </StyledIconWrapper>
        )}
      </ColumnWrapper>
    </StyledPanelItem>
  ) : isError ? (
    <LoadingError message={t('Failed to fetch issue')} />
  ) : null;
}

const StyledLoadingIndicatorWrapper = styled('div')`
  display: flex;
  justify-content: center;
  width: 100%;
  padding: ${space(2)} 0;
`;

const StyledIconWrapper = styled(IconWrapper)`
  margin: 0;
`;

const IssueSummaryWrapper = styled('div')`
  overflow: hidden;
  flex: 1;
  width: 66.66%;

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    width: 50%;
  }
`;

const ChartWrapper = styled('div')`
  width: 200px;
  align-self: center;
`;

const ColumnWrapper = styled('div')`
  display: flex;
  justify-content: flex-end;
  align-self: center;
  width: 60px;
  margin: 0 ${space(2)};
`;

const primaryStatStyle = (theme: Theme) => css`
  font-size: ${theme.fontSizeLarge};
  font-variant-numeric: tabular-nums;
`;

const PrimaryCount = styled(Count)`
  ${p => primaryStatStyle(p.theme)};
`;

const StyledPanelItem = styled(PanelItem)`
  padding-top: ${space(1)};
  padding-bottom: ${space(1)};
`;

export default Issue;
