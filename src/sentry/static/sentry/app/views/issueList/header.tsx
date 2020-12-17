import React from 'react';
import {InjectedRouter} from 'react-router';
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

import {Query} from './utils';

type Props = {
  query: string;
  queryCount: number;
  queryMaxCount: number;
  realtimeActive: boolean;
  orgSlug: Organization['slug'];
  router: InjectedRouter;
  projectIds: Array<string>;
  projects: Array<Project>;
  onRealtimeChange: (realtime: boolean) => void;
  onTabChange: (query: string) => void;
  hasReprocessingV2Feature?: boolean;
};

const queries = [
  [Query.NEEDS_REVIEW, t('Needs Review')],
  [Query.UNRESOLVED, t('Unresolved')],
  [Query.IGNORED, t('Ignored')],
  [Query.REPROCESSING, t('Reprocessing')],
];

function IssueListHeader({
  query,
  queryCount,
  queryMaxCount,
  orgSlug,
  projectIds,
  realtimeActive,
  onTabChange,
  onRealtimeChange,
  projects,
  router,
  hasReprocessingV2Feature,
}: Props) {
  const selectedProjectSlugs = projectIds
    .map(projectId => projects.find(project => project.id === projectId)?.slug)
    .filter(selectedProjectSlug => !!selectedProjectSlug) as Array<string>;

  const selectedProjectSlug =
    selectedProjectSlugs.length === 1 ? selectedProjectSlugs[0] : undefined;

  const tabs = hasReprocessingV2Feature
    ? queries
    : queries.filter(([tabQuery]) => tabQuery !== Query.REPROCESSING);

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
          {tabs.map(([tabQuery, queryName]) => (
            <li key={tabQuery} className={query === tabQuery ? 'active' : ''}>
              <a onClick={() => onTabChange(tabQuery)}>
                {queryName}{' '}
                {query === tabQuery && (
                  <StyledQueryCount count={queryCount} max={queryMaxCount} />
                )}
              </a>
            </li>
          ))}
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
