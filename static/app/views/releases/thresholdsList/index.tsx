import {useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import {Project} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';

import Header from '../components/header';
import {Threshold} from '../utils/types';
import useFetchThresholdsListData from '../utils/useFetchThresholdsListData';

import NoThresholdCard from './noThresholdCard';
import ThresholdGroupTable from './thresholdGroupTable';

type Props = {};

function ReleaseThresholdList({}: Props) {
  const [listError, setListError] = useState<string>('');
  const router = useRouter();
  const organization = useOrganization();
  useEffect(() => {
    const hasV2ReleaseUIEnabled = organization.features.includes('release-ui-v2');
    if (!hasV2ReleaseUIEnabled) {
      router.replace('/releases/');
    }
  }, [router, organization]);
  const {projects} = useProjects();
  const {selection} = usePageFilters();
  const {
    data: thresholds = [],
    error: requestError,
    isLoading,
    isError,
    refetch,
  } = useFetchThresholdsListData({
    selectedProjectIds: selection.projects,
    selectedEnvs: selection.environments,
  });

  const selectedProjects: Project[] = useMemo(() => {
    return projects.filter(
      project =>
        selection.projects.some(id => String(id) === project.id || id === -1) ||
        !selection.projects.length
    );
  }, [projects, selection.projects]);

  const projectsById: {[key: string]: Project} = useMemo(() => {
    const byId = {};
    selectedProjects.forEach(proj => {
      byId[proj.id] = proj;
    });
    return byId;
  }, [selectedProjects]);

  const getAllEnvironmentNames = useMemo((): string[] => {
    const selectedProjectIds = selection.projects.map(id => String(id));
    const {user} = ConfigStore.getState();
    const allEnvSet = new Set(projects.flatMap(project => project.environments));
    // NOTE: mostly taken from environmentSelector.tsx
    const unSortedEnvs = new Set(
      projects.flatMap(project => {
        /**
         * Include environments from:
         * all projects if the user is a superuser
         * the requested projects
         * all member projects if 'my projects' (empty list) is selected.
         * all projects if -1 is the only selected project.
         */
        if (
          (selectedProjectIds.length === 1 &&
            selectedProjectIds[0] === String(ALL_ACCESS_PROJECTS) &&
            project.hasAccess) ||
          (selectedProjectIds.length === 0 && (project.isMember || user.isSuperuser)) ||
          selectedProjectIds.includes(project.id)
        ) {
          return project.environments;
        }

        return [];
      })
    );
    const envDiff = new Set([...allEnvSet].filter(x => !unSortedEnvs.has(x)));

    // bubble the selected projects envs first, then concat the rest of the envs
    return Array.from(unSortedEnvs)
      .sort()
      .concat([...envDiff].sort());
  }, [projects, selection.projects]);

  /**
   * Thresholds filtered by environment selection
   * NOTE: currently no way to filter for 'None' environments
   */
  const filteredThresholds = selection.environments.length
    ? thresholds.filter(threshold => {
        return threshold.environment?.name
          ? selection.environments.indexOf(threshold.environment.name) > -1
          : !selection.environments.length;
      })
    : thresholds;

  const thresholdsByProject: {[key: string]: Threshold[]} = useMemo(() => {
    const byProj = {};
    filteredThresholds.forEach(threshold => {
      const projId = threshold.project.id;
      if (!byProj[projId]) {
        byProj[projId] = [];
      }
      byProj[projId].push(threshold);
    });
    return byProj;
  }, [filteredThresholds]);

  const projectsWithoutThresholds: Project[] = useMemo(() => {
    return selectedProjects.filter(proj => !thresholdsByProject[proj.id]);
  }, [thresholdsByProject, selectedProjects]);

  const setTempError = msg => {
    setListError(msg);
    setTimeout(() => setListError(''), 5000);
  };

  if (isError) {
    return <LoadingError onRetry={refetch} message={requestError.message} />;
  }
  if (isLoading) {
    return <LoadingIndicator />;
  }

  return (
    <PageFiltersContainer>
      <NoProjectMessage organization={organization}>
        <Header router={router} hasV2ReleaseUIEnabled />
        <Layout.Body>
          <Layout.Main fullWidth>
            <FilterRow>
              <ReleaseThresholdsPageFilterBar condensed>
                <GuideAnchor target="release_projects">
                  <ProjectPageFilter />
                </GuideAnchor>
                <EnvironmentPageFilter />
              </ReleaseThresholdsPageFilterBar>
              <ListError>{listError}</ListError>
            </FilterRow>
            {thresholdsByProject &&
              Object.entries(thresholdsByProject).map(([projId, thresholdsByProj]) => (
                <ThresholdGroupTable
                  key={projId}
                  project={projectsById[projId]}
                  thresholds={thresholdsByProj}
                  isLoading={isLoading}
                  isError={isError}
                  refetch={refetch}
                  setTempError={setTempError}
                  allEnvironmentNames={getAllEnvironmentNames} // TODO: determine whether to move down to threshold group table
                />
              ))}
            {projectsWithoutThresholds[0] && (
              <div>
                <div>Projects without Thresholds</div>
                {projectsWithoutThresholds.map(proj => (
                  <NoThresholdCard
                    key={proj.id}
                    project={proj}
                    allEnvironmentNames={getAllEnvironmentNames} // TODO: determine whether to move down to threshold group table
                    refetch={refetch}
                    setTempError={setTempError}
                  />
                ))}
              </div>
            )}
          </Layout.Main>
        </Layout.Body>
      </NoProjectMessage>
    </PageFiltersContainer>
  );
}

export default ReleaseThresholdList;

const FilterRow = styled('div')`
  display: flex;
  align-items: center;
`;

const ListError = styled('div')`
  color: red;
  margin: 0 ${space(2)};
  width: 100%;
  display: flex;
  justify-content: center;
`;

const ReleaseThresholdsPageFilterBar = styled(PageFilterBar)`
  margin-bottom: ${space(2)};
`;
