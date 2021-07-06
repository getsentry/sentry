import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import {SectionHeading} from 'app/components/charts/styles';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import GroupList from 'app/components/issues/groupList';
import {Panel, PanelBody} from 'app/components/panels';
import Tooltip from 'app/components/tooltip';
import {IconInfo} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {OrganizationSummary, Project} from 'app/types';
import {DATASET_EVENT_TYPE_FILTERS} from 'app/views/alerts/incidentRules/constants';
import {IncidentRule} from 'app/views/alerts/incidentRules/types';

import {TimePeriodType} from './constants';

type Props = {
  organization: OrganizationSummary;
  rule: IncidentRule;
  projects: Project[];
  timePeriod: TimePeriodType;
};

class RelatedIssues extends Component<Props> {
  renderEmptyMessage = () => {
    return (
      <Panel>
        <PanelBody>
          <EmptyStateWarning small withIcon={false}>
            {t('No issues for this alert rule')}
          </EmptyStateWarning>
        </PanelBody>
      </Panel>
    );
  };

  render() {
    const {rule, projects, organization, timePeriod} = this.props;
    const {start, end} = timePeriod;

    const path = `/organizations/${organization.slug}/issues/`;
    const queryParams = {
      start,
      end,
      groupStatsPeriod: 'auto',
      limit: 5,
      ...(rule.environment ? {environment: rule.environment} : {}),
      sort: rule.aggregate === 'count_unique(user)' ? 'user' : 'freq',
      query: [
        rule.query,
        rule.eventTypes?.length
          ? `event.type:[${rule.eventTypes.join(`, `)}]`
          : DATASET_EVENT_TYPE_FILTERS[rule.dataset],
      ].join(' '),
      project: projects.map(project => project.id),
    };
    const issueSearch = {
      pathname: `/organizations/${organization.slug}/issues/`,
      query: queryParams,
    };

    return (
      <Fragment>
        <ControlsWrapper>
          <StyledSectionHeading>
            {t('Related Issues')}
            <Tooltip title={t('Top issues containing events matching the metric.')}>
              <IconInfo size="xs" color="gray200" />
            </Tooltip>
          </StyledSectionHeading>
          <Button data-test-id="issues-open" size="small" to={issueSearch}>
            {t('Open in Issues')}
          </Button>
        </ControlsWrapper>

        <TableWrapper>
          <GroupList
            orgId={organization.slug}
            endpointPath={path}
            queryParams={queryParams}
            query={`start=${start}&end=${end}&groupStatsPeriod=auto`}
            canSelectGroups={false}
            renderEmptyMessage={this.renderEmptyMessage}
            withChart
            withPagination={false}
            useFilteredStats
            customStatsPeriod={timePeriod}
            useTintRow={false}
          />
        </TableWrapper>
      </Fragment>
    );
  }
}

const StyledSectionHeading = styled(SectionHeading)`
  display: flex;
  align-items: center;
`;

const ControlsWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(1)};
`;

const TableWrapper = styled('div')`
  margin-bottom: ${space(4)};
  ${Panel} {
    /* smaller space between table and pagination */
    margin-bottom: -${space(1)};
  }
`;

export default RelatedIssues;
