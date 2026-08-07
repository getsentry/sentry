import {Fragment} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Pagination} from '@sentry/scraps/pagination';

import type {DateTimeObject} from 'sentry/components/charts/utils';
import {Count} from 'sentry/components/count';
import {DateTime} from 'sentry/components/dateTime';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import type {IssueAlertRule} from 'sentry/types/alerts';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {getMessage, getTitle} from 'sentry/utils/events';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeFeedbackPathname} from 'sentry/views/feedback/pathnames';

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

export function AlertRuleIssuesList({
  project,
  rule,
  period,
  start,
  end,
  utc,
  cursor,
}: Props) {
  const organization = useOrganization();
  const {data, isPending, error} = useQuery({
    ...apiOptions.as<GroupHistory[]>()(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/rules/$ruleId/group-history/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: project.slug,
          ruleId: rule.id,
        },
        query: {
          per_page: 10,
          ...(period && {statsPeriod: period}),
          start,
          end,
          utc,
          cursor,
        },
        staleTime: 0,
      }
    ),
    select: selectJsonWithHeaders,
  });
  const groupHistory = data?.json;

  if (error instanceof RequestError) {
    return (
      <LoadingError
        message={(error.responseJSON?.detail as string) ?? t('default message')}
      />
    );
  }

  return (
    <Fragment>
      <StyledSimpleTable
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell>{t('Issue')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>
              <AlignRight>{t('Alerts')}</AlignRight>
            </SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>
              <AlignRight>{t('Events')}</AlignRight>
            </SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Last Triggered')}</SimpleTable.HeaderCell>
          </SimpleTable.HeaderRow>
        }
      >
        {isPending && (
          <SimpleTable.Empty>
            <LoadingIndicator />
          </SimpleTable.Empty>
        )}
        {!isPending && groupHistory?.length === 0 && (
          <SimpleTable.Empty>
            {t('No issues exist for the current query.')}
          </SimpleTable.Empty>
        )}
        {!isPending &&
          groupHistory?.map(({group: issue, count, lastTriggered, eventId}) => {
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
              <SimpleTable.Row key={issue.id}>
                <SimpleTable.RowCell>
                  <TitleWrapper>
                    <Link to={path}>{title}:</Link>
                    <MessageWrapper>{message}</MessageWrapper>
                  </TitleWrapper>
                </SimpleTable.RowCell>
                <SimpleTable.RowCell justify="end">
                  <Count value={count} />
                </SimpleTable.RowCell>
                <SimpleTable.RowCell justify="end">
                  <Count value={issue.count} />
                </SimpleTable.RowCell>
                <SimpleTable.RowCell>
                  <StyledDateTime date={lastTriggered} year seconds timeZone />
                </SimpleTable.RowCell>
              </SimpleTable.Row>
            );
          })}
      </StyledSimpleTable>
      <Flex justify="end" align="center" marginBottom="xl">
        <StyledPagination pageLinks={data?.headers.Link} size="xs" />
      </Flex>
    </Fragment>
  );
}

const StyledSimpleTable = styled(SimpleTable)`
  grid-template-columns: 1fr 0.2fr 0.2fr 0.5fr;
  font-size: ${p => p.theme.font.size.md};
  margin-bottom: ${p => p.theme.space.lg};

  [role='cell'] {
    padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
  }
`;

const AlignRight = styled('div')`
  text-align: right;
  font-variant-numeric: tabular-nums;
`;

const StyledDateTime = styled(DateTime)`
  white-space: nowrap;
  color: ${p => p.theme.tokens.content.secondary};
`;

const TitleWrapper = styled('div')`
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  gap: ${p => p.theme.space.xs};
  min-width: 200px;
`;

const MessageWrapper = styled('span')`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: ${p => p.theme.tokens.content.primary};
`;

const StyledPagination = styled(Pagination)`
  margin-top: 0;
`;
