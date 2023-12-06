import {Fragment, useMemo, useRef} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import EmptyMessage from 'sentry/components/emptyMessage';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import Placeholder from 'sentry/components/placeholder';
import SearchBar from 'sentry/components/searchBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Project} from 'sentry/types';
import {sortProjects} from 'sentry/utils';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import routeTitleGen from 'sentry/utils/routeTitle';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import ProjectListItem from 'sentry/views/settings/components/settingsProjectItem';
import CreateProjectButton from 'sentry/views/settings/organizationProjects/createProjectButton';

import ProjectStatsGraph from './projectStatsGraph';

const ITEMS_PER_PAGE = 50;

type ProjectStats = Record<string, Required<Project['stats']>>;

function OrganizationProjects() {
  const organization = useOrganization();

  const location = useLocation();
  const query = decodeScalar(location.query.query, '');

  const time = useRef(new Date().getTime());
  const {
    data: projectList,
    getResponseHeader,
    isLoading,
    isError,
  } = useApiQuery<Project[]>(
    [
      `/organizations/${organization.slug}/projects/`,
      {
        query: {
          ...location.query,
          query,
          per_page: ITEMS_PER_PAGE,
        },
      },
    ],
    {staleTime: 0}
  );

  const {data: projectStats, isLoading: isLoadingStats} = useApiQuery<ProjectStats>(
    [
      `/organizations/${organization.slug}/stats/`,
      {
        query: {
          since: time.current / 1000 - 3600 * 24,
          stat: 'generated',
          group: 'project',
          per_page: ITEMS_PER_PAGE,
        },
      },
    ],
    {staleTime: 0}
  );

  const projectListPageLinks = getResponseHeader?.('Link');
  const action = <CreateProjectButton />;

  const debouncedSearch = useMemo(
    () =>
      debounce(
        (searchQuery: string) =>
          browserHistory.replace({
            pathname: location.pathname,
            query: {...location.query, query: searchQuery},
          }),
        DEFAULT_DEBOUNCE_DURATION
      ),
    [location.pathname, location.query]
  );

  return (
    <Fragment>
      <SentryDocumentTitle
        title={routeTitleGen(t('Projects'), organization.slug, false)}
      />
      <SettingsPageHeader title="Projects" action={action} />
      <SearchWrapper>
        <SearchBar
          placeholder={t('Search Projects')}
          onChange={debouncedSearch}
          query={query}
        />
      </SearchWrapper>
      <Panel>
        <PanelHeader>{t('Projects')}</PanelHeader>
        <PanelBody>
          {isLoading && <LoadingIndicator />}
          {isError && <LoadingError />}
          {projectList &&
            sortProjects(projectList).map(project => (
              <GridPanelItem key={project.id}>
                <ProjectListItemWrapper>
                  <ProjectListItem project={project} organization={organization} />
                </ProjectListItemWrapper>
                <ProjectStatsGraphWrapper>
                  {isLoadingStats && <Placeholder height="25px" />}
                  {projectStats && (
                    <ProjectStatsGraph
                      key={project.id}
                      project={project}
                      stats={projectStats[project.id]}
                    />
                  )}
                </ProjectStatsGraphWrapper>
              </GridPanelItem>
            ))}
          {projectList && projectList.length === 0 && (
            <EmptyMessage>{t('No projects found.')}</EmptyMessage>
          )}
        </PanelBody>
      </Panel>
      {projectListPageLinks && <Pagination pageLinks={projectListPageLinks} />}
    </Fragment>
  );
}

export default OrganizationProjects;

const SearchWrapper = styled('div')`
  margin-bottom: ${space(2)};
`;

const GridPanelItem = styled(PanelItem)`
  display: flex;
  align-items: center;
  padding: 0;
`;

const ProjectListItemWrapper = styled('div')`
  padding: ${space(2)};
  flex: 1;
`;

const ProjectStatsGraphWrapper = styled('div')`
  padding: ${space(2)};
  width: 25%;
  margin-left: ${space(2)};
`;
