import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';
import pick from 'lodash/pick';

import Button from 'app/components/button';
import {SectionHeading} from 'app/components/charts/styles';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import GroupList from 'app/components/issues/groupList';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {Panel, PanelBody} from 'app/components/panels';
import {DEFAULT_RELATIVE_PERIODS, DEFAULT_STATS_PERIOD} from 'app/constants';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {decodeScalar} from 'app/utils/queryString';

type Props = {
  organization: Organization;
  location: Location;
};

function ProjectIssues({organization, location}: Props) {
  function handleOpenClick() {
    trackAnalyticsEvent({
      eventKey: 'project_detail.open_issues',
      eventName: 'Project Detail: Open issues from project detail',
      organization_id: parseInt(organization.id, 10),
    });
  }

  function renderEmptyMessage() {
    const selectedTimePeriod = location.query.start
      ? null
      : DEFAULT_RELATIVE_PERIODS[
          decodeScalar(location.query.statsPeriod, DEFAULT_STATS_PERIOD)
        ];
    const displayedPeriod = selectedTimePeriod
      ? selectedTimePeriod.toLowerCase()
      : t('given timeframe');

    return (
      <Panel>
        <PanelBody>
          <EmptyStateWarning small withIcon={false}>
            {tct('No issues for the [timePeriod].', {
              timePeriod: displayedPeriod,
            })}
          </EmptyStateWarning>
        </PanelBody>
      </Panel>
    );
  }

  const endpointPath = `/organizations/${organization.slug}/issues/`;
  const queryParams = {
    limit: 5,
    ...getParams(pick(location.query, [...Object.values(URL_PARAM), 'cursor'])),
    query: 'is:unresolved',
    sort: 'freq',
  };

  const issueSearch = {
    pathname: endpointPath,
    query: queryParams,
  };

  return (
    <React.Fragment>
      <ControlsWrapper>
        <SectionHeading>{t('Project Issues')}</SectionHeading>
        <Button
          data-test-id="issues-open"
          size="small"
          to={issueSearch}
          onClick={handleOpenClick}
        >
          {t('Open in Issues')}
        </Button>
      </ControlsWrapper>

      <TableWrapper>
        <GroupList
          orgId={organization.slug}
          endpointPath={endpointPath}
          queryParams={queryParams}
          query=""
          canSelectGroups={false}
          renderEmptyMessage={renderEmptyMessage}
          withChart={false}
          withPagination
        />
      </TableWrapper>
    </React.Fragment>
  );
}

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

export default ProjectIssues;
