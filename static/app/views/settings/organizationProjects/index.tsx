import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';
import debounce from 'lodash/debounce';

import {Container, Flex} from '@sentry/scraps/layout';
import {Pagination} from '@sentry/scraps/pagination';

import {EmptyMessage} from 'sentry/components/emptyMessage';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {PanelItem} from 'sentry/components/panels/panelItem';
import {SearchBar} from 'sentry/components/searchBar';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {t} from 'sentry/locale';
import type {Project, ProjectStats} from 'sentry/types/project';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {sortProjects} from 'sentry/utils/project/sortProjects';
import {decodeScalar} from 'sentry/utils/queryString';
import {routeTitleGen} from 'sentry/utils/routeTitle';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {ProjectItem} from 'sentry/views/settings/components/settingsProjectItem';
import {CreateProjectButton} from 'sentry/views/settings/organizationProjects/createProjectButton';

import {ProjectStatsGraph} from './projectStatsGraph';

const ITEMS_PER_PAGE = 50;
type ProjectListItem = Project & {stats?: ProjectStats};

function OrganizationProjects() {
  const organization = useOrganization();
  const hasPageFrame = useHasPageFrameFeature();

  const navigate = useNavigate();
  const location = useLocation();
  const query = decodeScalar(location.query.query, '');

  const {
    data: projectListResponse,
    isPending,
    isError,
  } = useQuery({
    ...apiOptions.as<ProjectListItem[]>()(
      '/organizations/$organizationIdOrSlug/projects/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          ...location.query,
          query,
          per_page: ITEMS_PER_PAGE,
          statsPeriod: '24h',
          collapse: ['latestDeploys', 'unusedFeatures'],
        },
        staleTime: 0,
      }
    ),
    select: selectJsonWithHeaders,
  });

  const projectList = projectListResponse?.json;
  const projectListPageLinks = projectListResponse?.headers.Link;
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
      <SettingsPageHeader title="Projects" action={hasPageFrame ? undefined : action} />
      <SearchWrapper>
        <Flex align="center" gap="md">
          <Container flex={1}>
            {({className}) => (
              <SearchBar
                className={className}
                placeholder={t('Search Projects')}
                onChange={debouncedSearch}
                query={query}
              />
            )}
          </Container>
          {hasPageFrame && action}
        </Flex>
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
                  <ProjectStatsGraph stats={project.stats} />
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
