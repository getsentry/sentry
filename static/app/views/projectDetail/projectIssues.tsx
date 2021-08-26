import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';
import pick from 'lodash/pick';

import {Client} from 'app/api';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {SectionHeading} from 'app/components/charts/styles';
import DiscoverButton from 'app/components/discoverButton';
import GroupList from 'app/components/issues/groupList';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import Pagination from 'app/components/pagination';
import {Panel, PanelBody} from 'app/components/panels';
import {DEFAULT_RELATIVE_PERIODS, DEFAULT_STATS_PERIOD} from 'app/constants';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {decodeScalar} from 'app/utils/queryString';

import NoGroupsHandler from '../issueList/noGroupsHandler';

type Props = {
  organization: Organization;
  location: Location;
  projectId: number;
  api: Client;
  query?: string;
};

function ProjectIssues({organization, location, projectId, query, api}: Props) {
  const [pageLinks, setPageLinks] = useState<string | undefined>();
  const [onCursor, setOnCursor] = useState<(() => void) | undefined>();

  function handleOpenInIssuesClick() {
    trackAnalyticsEvent({
      eventKey: 'project_detail.open_issues',
      eventName: 'Project Detail: Open issues from project detail',
      organization_id: parseInt(organization.id, 10),
    });
  }

  function handleOpenInDiscoverClick() {
    trackAnalyticsEvent({
      eventKey: 'project_detail.open_discover',
      eventName: 'Project Detail: Open discover from project detail',
      organization_id: parseInt(organization.id, 10),
    });
  }

  function handleFetchSuccess(groupListState, cursorHandler) {
    setPageLinks(groupListState.pageLinks);
    setOnCursor(() => cursorHandler);
  }

  function getDiscoverUrl() {
    return {
      pathname: `/organizations/${organization.slug}/discover/results/`,
      query: {
        name: t('Frequent Unhandled Issues'),
        field: ['issue', 'title', 'count()', 'count_unique(user)', 'project'],
        sort: ['-count'],
        query: ['event.type:error error.unhandled:true', query].join(' ').trim(),
        display: 'top5',
        ...getParams(pick(location.query, [...Object.values(URL_PARAM)])),
      },
    };
  }

  const endpointPath = `/organizations/${organization.slug}/issues/`;
  const issueQuery = ['is:unresolved error.unhandled:true ', query].join(' ').trim();
  const queryParams = {
    limit: 5,
    ...getParams(pick(location.query, [...Object.values(URL_PARAM), 'cursor'])),
    query: issueQuery,
    sort: 'freq',
  };

  const issueSearch = {
    pathname: endpointPath,
    query: queryParams,
  };

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
          <NoGroupsHandler
            api={api}
            organization={organization}
            query={issueQuery}
            selectedProjectIds={[projectId]}
            groupIds={[]}
            emptyMessage={tct('No unhandled issues for the [timePeriod].', {
              timePeriod: displayedPeriod,
            })}
          />
        </PanelBody>
      </Panel>
    );
  }

  return (
    <Fragment>
      <ControlsWrapper>
        <SectionHeading>{t('Frequent Unhandled Issues')}</SectionHeading>
        <ButtonBar gap={1}>
          <Button
            data-test-id="issues-open"
            size="small"
            to={issueSearch}
            onClick={handleOpenInIssuesClick}
          >
            {t('Open in Issues')}
          </Button>
          <DiscoverButton
            onClick={handleOpenInDiscoverClick}
            to={getDiscoverUrl()}
            size="small"
          >
            {t('Open in Discover')}
          </DiscoverButton>
          <StyledPagination pageLinks={pageLinks} onCursor={onCursor} />
        </ButtonBar>
      </ControlsWrapper>

      <GroupList
        orgId={organization.slug}
        endpointPath={endpointPath}
        queryParams={queryParams}
        query=""
        canSelectGroups={false}
        renderEmptyMessage={renderEmptyMessage}
        withChart={false}
        withPagination={false}
        onFetchSuccess={handleFetchSuccess}
      />
    </Fragment>
  );
}

const ControlsWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(1)};
  flex-wrap: wrap;
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: block;
  }
`;

const StyledPagination = styled(Pagination)`
  margin: 0;
`;

export default ProjectIssues;
