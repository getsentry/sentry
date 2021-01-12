import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import {SectionHeading} from 'app/components/charts/styles';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import GroupList from 'app/components/issues/groupList';
import {Panel, PanelBody} from 'app/components/panels';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {OrganizationSummary} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {Incident} from 'app/views/alerts/types';

type Props = {
  organization: OrganizationSummary;
  incident: Incident;
  statsPeriod?: string;
  start?: string;
  end?: string;
};

class RelatedIssues extends React.Component<Props> {
  renderEmptyMessage = () => {
    return (
      <Panel>
        <PanelBody>
          <EmptyStateWarning small withIcon={false}>
            {t('No issues for this alert')}
          </EmptyStateWarning>
        </PanelBody>
      </Panel>
    );
  };

  render() {
    const {incident, organization, start, end, statsPeriod} = this.props;

    const path = `/organizations/${organization.slug}/issues/`;
    const queryParams = {
      start,
      end,
      statsPeriod,
      limit: 5,
      sort: 'new',
      query: incident.alertRule.query,
    };
    const issueSearch = {
      pathname: `/organizations/${organization.slug}/issues/`,
      query: queryParams,
    };

    return (
      <React.Fragment>
        <ControlsWrapper>
          <SectionHeading>{t('Related Issues')}</SectionHeading>
          <Button
            data-test-id="issues-open"
            size="small"
            to={issueSearch}
            onClick={() =>
              trackAnalyticsEvent({
                eventKey: 'performance_views.summary.open_issues',
                eventName: 'Performance Views: Open issues from transaction summary',
                organization_id: parseInt(organization.id, 10),
              })
            }
          >
            {t('Open in Issues')}
          </Button>
        </ControlsWrapper>

        <TableWrapper>
          <GroupList
            orgId={organization.slug}
            endpointPath={path}
            queryParams={queryParams}
            query=""
            canSelectGroups={false}
            renderEmptyMessage={this.renderEmptyMessage}
            withChart={false}
            withPagination={false}
          />
        </TableWrapper>
      </React.Fragment>
    );
  }
}

// const IssuesWrapper = styled('div')`
//   //display: flex;
//   //flex-direction: column;
//   //align-items: center;
//   //justify-content: space-between;
//   //margin-bottom: ${space(1)};
// `;

const ControlsWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const TableWrapper = styled('div')`
  margin-bottom: ${space(4)};
  ${Panel} {
    /* smaller space between table and pagination */
    margin-bottom: -${space(1)};
  }
`;

export default RelatedIssues;
