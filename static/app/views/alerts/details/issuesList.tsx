import {Fragment} from 'react';
import styled from '@emotion/styled';
import random from 'lodash/random';

import AsyncComponent from 'sentry/components/asyncComponent';
import type {DateTimeObject} from 'sentry/components/charts/utils';
import Count from 'sentry/components/count';
import DateTime from 'sentry/components/dateTime';
import Link from 'sentry/components/links/link';
import Pagination from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {Group, Organization, Project} from 'sentry/types';
import {getMessage, getTitle} from 'sentry/utils/events';

type Props = AsyncComponent['props'] &
  DateTimeObject & {
    organization: Organization;
    project: Project;
    cursor?: string;
  };

type State = AsyncComponent['state'] & {
  issues: Group[] | null;
};

class AlertRuleIssuesList extends AsyncComponent<Props, State> {
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
      issues: null,
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {project, organization, period, start, end, utc, cursor} = this.props;
    return [
      [
        'issues',
        `/organizations/${organization.slug}/issues/`,
        {
          query: {
            query: 'is:unresolved',
            limit: '10',
            project: project.id,
            statsPeriod: period,
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
    const {organization} = this.props;
    const {loading, issues, issuesPageLinks} = this.state;

    return (
      <Fragment>
        <StyledPanelTable
          isLoading={loading}
          headers={[
            t('Issue'),
            <AlignRight key="alerts">{t('Alerts')}</AlignRight>,
            <AlignRight key="events">{t('Events')}</AlignRight>,
            t('Last Triggered'),
          ]}
        >
          {issues?.map(issue => {
            const message = getMessage(issue);
            const {title} = getTitle(issue);

            return (
              <Fragment key={issue.id}>
                <TitleWrapper>
                  <Link to={`/organizations/${organization.slug}/issues/${issue.id}/`}>
                    {title}:
                  </Link>
                  <MessageWrapper>{message}</MessageWrapper>
                </TitleWrapper>
                <AlignRight>
                  <Count value={random(1, 200)} />
                </AlignRight>
                <AlignRight>
                  <Count value={random(1, 2000)} />
                </AlignRight>
                <div>
                  <StyledDateTime date={issue.lastSeen} />
                </div>
              </Fragment>
            );
          })}
        </StyledPanelTable>
        <PaginationWrapper>
          <StyledPagination pageLinks={issuesPageLinks} size="xsmall" />
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

  & > div {
    padding: ${space(1)} ${space(2)};
  }
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
  ${overflowEllipsis};
  display: flex;
  gap: ${space(0.5)};
`;

const MessageWrapper = styled('span')`
  ${overflowEllipsis};
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
