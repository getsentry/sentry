import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {DateTimeObject} from 'sentry/components/charts/utils';
import Count from 'sentry/components/count';
import DateTime from 'sentry/components/dateTime';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import Link from 'sentry/components/links/link';
import Pagination from 'sentry/components/pagination';
import PanelTable from 'sentry/components/panels/panelTable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Group, Organization, Project} from 'sentry/types';
import {IssueAlertRule} from 'sentry/types/alerts';
import {getMessage, getTitle} from 'sentry/utils/events';
import getDynamicText from 'sentry/utils/getDynamicText';

type GroupHistory = {
  count: number;
  eventId: string;
  group: Group;
  lastTriggered: string;
};

type Props = DeprecatedAsyncComponent['props'] &
  DateTimeObject & {
    organization: Organization;
    project: Project;
    rule: IssueAlertRule;
    cursor?: string;
  };

type State = DeprecatedAsyncComponent['state'] & {
  groupHistory: GroupHistory[] | null;
};

class AlertRuleIssuesList extends DeprecatedAsyncComponent<Props, State> {
  shouldRenderBadRequests = true;

  componentDidUpdate(prevProps: Props) {
    const {project, organization, start, end, period, utc, cursor} = this.props;

    if (
      prevProps.start !== start ||
      prevProps.end !== end ||
      prevProps.period !== period ||
      prevProps.utc !== utc ||
      prevProps.organization.id !== organization.id ||
      prevProps.project.id !== project.id ||
      prevProps.cursor !== cursor
    ) {
      this.remountComponent();
    }
  }

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      groupHistory: null,
    };
  }

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {project, rule, organization, period, start, end, utc, cursor} = this.props;
    return [
      [
        'groupHistory',
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
    ];
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {organization, rule} = this.props;
    const {loading, groupHistory, groupHistoryPageLinks} = this.state;

    return (
      <Fragment>
        <StyledPanelTable
          isLoading={loading}
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

            return (
              <Fragment key={issue.id}>
                <TitleWrapper>
                  <Link
                    to={{
                      pathname:
                        `/organizations/${organization.slug}/issues/${issue.id}/` +
                        (eventId ? `events/${eventId}` : ''),
                      query: {
                        referrer: 'alert-rule-issue-list',
                        ...(rule.environment ? {environment: rule.environment} : {}),
                      },
                    }}
                  >
                    {title}:
                  </Link>
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
          <StyledPagination pageLinks={groupHistoryPageLinks} size="xs" />
        </PaginationWrapper>
      </Fragment>
    );
  }
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
