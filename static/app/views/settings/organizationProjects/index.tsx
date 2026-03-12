import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {EmptyMessage} from 'sentry/components/emptyMessage';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {PanelItem} from 'sentry/components/panels/panelItem';
import SearchBar from 'sentry/components/searchBar';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {sortProjects} from 'sentry/utils/project/sortProjects';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import routeTitleGen from 'sentry/utils/routeTitle';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {ProjectItem} from 'sentry/views/settings/components/settingsProjectItem';
import {CreateProjectButton} from 'sentry/views/settings/organizationProjects/createProjectButton';

import {ProjectStatsGraph} from './projectStatsGraph';

const ITEMS_PER_PAGE = 50;

function OrganizationProjects() {
  const organization = useOrganization();

  const navigate = useNavigate();
  const location = useLocation();
  const query = decodeScalar(location.query.query, '');

  const {
    data: projectList,
    getResponseHeader,
    isPending,
    isError,
  } = useApiQuery<Project[]>(
    [
      getApiUrl(`/organizations/$organizationIdOrSlug/projects/`, {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {
        query: {
          ...location.query,
          query,
          per_page: ITEMS_PER_PAGE,
          statsPeriod: '24h',
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
          navigate(
            {
              query: {...location.query, query: searchQuery, cursor: undefined},
            },
            {replace: true}
          ),
        DEFAULT_DEBOUNCE_DURATION
      ),
    [location.query, navigate]
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
          {isPending && <LoadingIndicator />}
          {isError && <LoadingError />}
          {projectList &&
            sortProjects(projectList).map(project => (
              <GridPanelItem key={project.id}>
                <ProjectListItemWrapper>
                  <ProjectItem project={project} organization={organization} />
                </ProjectListItemWrapper>
                <ProjectStatsGraphWrapper>
                  <ProjectStatsGraph project={project} />
                </ProjectStatsGraphWrapper>
              </GridPanelItem>
            ))}
          {projectList?.length === 0 && (
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
  margin-bottom: ${p => p.theme.space.xl};
`;

const GridPanelItem = styled(PanelItem)`
  display: flex;
  align-items: center;
  padding: 0;
`;

const ProjectListItemWrapper = styled('div')`
  padding: ${p => p.theme.space.xl};
  flex: 1;
`;

const ProjectStatsGraphWrapper = styled('div')`
  padding: ${p => p.theme.space.xl};
  width: 25%;
  margin-left: ${p => p.theme.space.xl};
`;
