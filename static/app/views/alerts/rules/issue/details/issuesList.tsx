import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {DateTimeObject} from 'sentry/components/charts/utils';
import Count from 'sentry/components/count';
import {DateTime} from 'sentry/components/dateTime';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import Pagination from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {IssueAlertRule} from 'sentry/types/alerts';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getMessage, getTitle} from 'sentry/utils/events';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';
import getDynamicText from 'sentry/utils/getDynamicText';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {makeFeedbackPathname} from 'sentry/views/userFeedback/pathnames';

type GroupHistory = {
  count: number;
  eventId: string;
  group: Group;
  lastTriggered: string;
};

type Props = DateTimeObject & {
  project: Project;
  rule: IssueAlertRule;
  cursor?: string;
};

function AlertRuleIssuesList({project, rule, period, start, end, utc, cursor}: Props) {
  const organization = useOrganization();
  const {
    data: groupHistory,
    getResponseHeader,
    isPending,
    isError,
    error,
  } = useApiQuery<GroupHistory[]>(
    [
      `/projects/${organization.slug}/${project.slug}/rules/${rule.id}/group-history/`,
      {
        query: {
          per_page: 10,
          ...(period && {statsPeriod: period}),
          start,
          end,
          utc,
          cursor,
        },
      },
    ],
    {staleTime: 0}
  );

  if (isError) {
    return (
      <LoadingError
        message={(error?.responseJSON?.detail as string) ?? t('default message')}
      />
    );
  }

  return (
    <Fragment>
      <StyledPanelTable
        isLoading={isPending}
        isEmpty={groupHistory?.length === 0}
        emptyMessage={t('No issues exist for the current query.')}
        headers={[
          t('Issue'),
          <AlignRight key="alerts">{t('Alerts')}</AlignRight>,
          <AlignRight key="events">{t('Events')}</AlignRight>,
          t('Last Triggered'),
        ]}
      >
        {groupHistory?.map(({group: issue, count, lastTriggered, eventId}) => {
          const message = getMessage(issue);
          const {title} = getTitle(issue);
          const path =
            (issue as unknown as FeedbackIssue).issueType === 'feedback'
              ? {
                  pathname: makeFeedbackPathname({
                    path: '/',
                    organization,
                  }),
                  query: {feedbackSlug: `${issue.project.slug}:${issue.id}`},
                }
              : {
                  pathname: `/organizations/${organization.slug}/issues/${issue.id}/${
                    eventId ? `events/${eventId}` : ''
                  }`,
                  query: {
                    referrer: 'alert-rule-issue-list',
                    ...(rule.environment ? {environment: rule.environment} : {}),
                  },
                };

          return (
            <Fragment key={issue.id}>
              <TitleWrapper>
                <Link to={path}>{title}:</Link>
                <MessageWrapper>{message}</MessageWrapper>
              </TitleWrapper>
              <AlignRight>
                <Count value={count} />
              </AlignRight>
              <AlignRight>
                <Count value={issue.count} />
              </AlignRight>
              <div>
                <StyledDateTime
                  date={getDynamicText({
                    value: lastTriggered,
                    fixed: 'Mar 16, 2020 9:10:13 AM UTC',
                  })}
                  year
                  seconds
                  timeZone
                />
              </div>
            </Fragment>
          );
        })}
      </StyledPanelTable>
      <PaginationWrapper>
        <StyledPagination pageLinks={getResponseHeader?.('Link')} size="xs" />
      </PaginationWrapper>
    </Fragment>
  );
}

export default AlertRuleIssuesList;

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: 1fr 0.2fr 0.2fr 0.5fr;
  font-size: ${p => p.theme.fontSizeMedium};
  margin-bottom: ${space(1.5)};

  ${p =>
    !p.isEmpty &&
    css`
      & > div {
        padding: ${space(1)} ${space(2)};
      }
    `}
`;

const AlignRight = styled('div')`
  text-align: right;
  font-variant-numeric: tabular-nums;
`;

const StyledDateTime = styled(DateTime)`
  white-space: nowrap;
  color: ${p => p.theme.subText};
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

const PaginationWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-bottom: ${space(2)};
`;

const StyledPagination = styled(Pagination)`
  margin-top: 0;
`;
