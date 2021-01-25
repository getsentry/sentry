import React from 'react';
import {InjectedRouter, Link} from 'react-router';
import styled from '@emotion/styled';
import PropTypes from 'prop-types';

import {openModal} from 'app/actionCreators/modal';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import ContextPickerModalContainer from 'app/components/contextPickerModal';
import * as Layout from 'app/components/layouts/thirds';
import QueryCount from 'app/components/queryCount';
import {IconPause, IconPlay, IconUser} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import withProjects from 'app/utils/withProjects';

import SavedSearchTab from './savedSearchTab';
import {getTabs, Query, QueryCounts, TAB_MAX_COUNT} from './utils';

type Props = {
  organization: Organization;
  query: string;
  queryCounts: QueryCounts;
  realtimeActive: boolean;
  orgSlug: Organization['slug'];
  router: InjectedRouter;
  projectIds: Array<string>;
  projects: Array<Project>;
  onRealtimeChange: (realtime: boolean) => void;
  displayReprocessingTab: boolean;
  queryCount?: number;
} & React.ComponentProps<typeof SavedSearchTab>;

function IssueListHeader({
  organization,
  query,
  queryCount,
  queryCounts,
  orgSlug,
  projectIds,
  realtimeActive,
  onRealtimeChange,
  onSavedSearchSelect,
  onSavedSearchDelete,
  savedSearchList,
  projects,
  router,
  displayReprocessingTab,
}: Props) {
  const selectedProjectSlugs = projectIds
    .map(projectId => projects.find(project => project.id === projectId)?.slug)
    .filter(selectedProjectSlug => !!selectedProjectSlug) as Array<string>;

  const selectedProjectSlug =
    selectedProjectSlugs.length === 1 ? selectedProjectSlugs[0] : undefined;

  const tabs = getTabs(organization);
  const visibleTabs = displayReprocessingTab
    ? tabs
    : tabs.filter(([tab]) => tab !== Query.REPROCESSING);
  const savedSearchTabActive = !visibleTabs.some(([tabQuery]) => tabQuery === query);

  function handleSelectProject(settingsPage: string) {
    return function (event: React.MouseEvent) {
      event.preventDefault();

      openModal(modalProps => (
        <ContextPickerModalContainer
          {...modalProps}
          nextPath={`/settings/${orgSlug}/projects/:projectId/${settingsPage}/`}
          needProject
          needOrg={false}
          onFinish={path => {
            modalProps.closeModal();
            router.push(path);
          }}
          projectSlugs={
            !!selectedProjectSlugs.length
              ? selectedProjectSlugs
              : projects.map(p => p.slug)
          }
        />
      ));
    };
  }

  return (
    <React.Fragment>
      <BorderlessHeader>
        <StyledHeaderContent>
          <StyledLayoutTitle>{t('Issues')}</StyledLayoutTitle>
        </StyledHeaderContent>
        <Layout.HeaderActions>
          <ButtonBar gap={1}>
            <Button
              size="small"
              icon={<IconUser size="xs" />}
              to={
                selectedProjectSlug
                  ? `/settings/${orgSlug}/projects/${selectedProjectSlug}/ownership/`
                  : undefined
              }
              onClick={selectedProjectSlug ? undefined : handleSelectProject('ownership')}
            >
              {t('Issue Owners')}
            </Button>
            <Button
              size="small"
              title={t('%s real-time updates', realtimeActive ? t('Pause') : t('Enable'))}
              onClick={() => onRealtimeChange(!realtimeActive)}
            >
              {realtimeActive ? <IconPause size="xs" /> : <IconPlay size="xs" />}
            </Button>
          </ButtonBar>
        </Layout.HeaderActions>
      </BorderlessHeader>
      <TabLayoutHeader>
        <Layout.HeaderNavTabs underlined>
          {visibleTabs.map(([tabQuery, {name: queryName}]) => (
            <li key={tabQuery} className={query === tabQuery ? 'active' : ''}>
              <Link
                to={{
                  query: {...router?.location?.query, query: tabQuery},
                  pathname: `/organizations/${organization.slug}/issues/`,
                }}
              >
                {queryName}{' '}
                {queryCounts[tabQuery] && (
                  <StyledQueryCount
                    isTag
                    count={queryCounts[tabQuery].count}
                    max={queryCounts[tabQuery].hasMore ? TAB_MAX_COUNT : 1000}
                  />
                )}
              </Link>
            </li>
          ))}
          <SavedSearchTab
            organization={organization}
            query={query}
            savedSearchList={savedSearchList}
            onSavedSearchSelect={onSavedSearchSelect}
            onSavedSearchDelete={onSavedSearchDelete}
            isActive={savedSearchTabActive}
            queryCount={queryCount}
          />
        </Layout.HeaderNavTabs>
      </TabLayoutHeader>
    </React.Fragment>
  );
}

export default withProjects(IssueListHeader);

IssueListHeader.propTypes = {
  projectIds: PropTypes.array.isRequired,
  projects: PropTypes.array.isRequired,
};

const StyledLayoutTitle = styled(Layout.Title)`
  margin-top: ${space(0.5)};
`;

const BorderlessHeader = styled(Layout.Header)`
  border-bottom: 0;

  /* Not enough buttons to change direction for mobile view */
  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    flex-direction: row;
  }
`;

const TabLayoutHeader = styled(Layout.Header)`
  padding-top: 0;

  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    padding-top: 0;
  }
`;

const StyledHeaderContent = styled(Layout.HeaderContent)`
  margin-bottom: 0;
  margin-right: ${space(2)};
`;

const StyledQueryCount = styled(QueryCount)`
  color: ${p => p.theme.gray300};
`;
