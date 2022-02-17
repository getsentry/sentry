import {Fragment} from 'react';
import styled from '@emotion/styled';
import random from 'lodash/random';

import AsyncComponent from 'sentry/components/asyncComponent';
import Count from 'sentry/components/count';
import DateTime from 'sentry/components/dateTime';
import EventOrGroupTitle from 'sentry/components/eventOrGroupTitle';
import Link from 'sentry/components/links/link';
import {PanelTable} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Group, Organization, Project} from 'sentry/types';

type Props = AsyncComponent['props'] & {
  organization: Organization;
  project: Project;
};

type State = AsyncComponent['state'] & {
  issues: Group[] | null;
};

class AlertRuleIssuesList extends AsyncComponent<Props, State> {
  shouldRenderBadRequests = true;

  componentDidUpdate() {
    // TODO
  }

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      issues: null,
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {project, organization} = this.props;
    return [
      [
        'issues',
        `/organizations/${organization.slug}/issues/`,
        {
          query: {
            query: 'is:unassigned',
            collapse: 'stats',
            limit: '10',
            project: project.id,
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
    const {loading, issues} = this.state;
    return (
      <StyledPanelTable
        isLoading={loading}
        headers={[
          t('Issue'),
          <AlignRight key="alerts">{t('Alerts')}</AlignRight>,
          <AlignRight key="events">{t('Events')}</AlignRight>,
          t('Last Triggered'),
        ]}
      >
        {issues?.map(issue => (
          <Fragment key={issue.id}>
            <div>
              <Link to={`/organizations/${organization.slug}/issues/${issue.id}/`}>
                <EventOrGroupTitle data={issue} organization={organization} />
              </Link>
            </div>
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
        ))}
      </StyledPanelTable>
    );
  }
}

export default AlertRuleIssuesList;

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: 1fr 0.2fr 0.2fr 0.5fr;
  font-size: ${p => p.theme.fontSizeMedium};

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
