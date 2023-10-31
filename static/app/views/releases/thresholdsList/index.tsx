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
import PanelTable from 'sentry/components/panels/panelTable';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import {Project} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';

import Header from '../components/header';
import {NEW_GROUP_PREFIX} from '../utils/constants';
import {NewThresholdGroup, Threshold} from '../utils/types';
import useFetchThresholdsListData from '../utils/useFetchThresholdsListData';

import {ThresholdGroupRows} from './thresholdGroupRows';

type Props = {};

function ReleaseThresholdList({}: Props) {
  const [listError, setListError] = useState<string>('');
  const router = useRouter();
  const organization = useOrganization();
  const [newThresholdGroup, setNewThresholdGroup] = useState<NewThresholdGroup[]>([]);
  const [newGroupIterator, setNewGroupIterator] = useState<number>(0);
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
    return projects.filter(project =>
      selection.projects.some(id => String(id) === project.id || id === -1)
    );
  }, [projects, selection.projects]);

  const getAllEnvironments = (): string[] => {
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
  };

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

  const thresholdGroups: {[key: string]: {[key: string]: Threshold[]}} = useMemo(() => {
    const byProj = {};
    filteredThresholds.forEach(threshold => {
      const projId = threshold.project.id;
      if (!byProj[projId]) {
        byProj[projId] = {};
      }
      const env = threshold.environment ? threshold.environment.name : '';
      if (!byProj[projId][env]) {
        byProj[projId][env] = [];
      }
      byProj[projId][env].push(threshold);
    });
    return byProj;
  }, [filteredThresholds]);

  const tempError = msg => {
    setListError(msg);
    setTimeout(() => setListError(''), 5000);
  };

  if (isError) {
    return <LoadingError onRetry={refetch} message={requestError.message} />;
  }
  if (isLoading) {
    return <LoadingIndicator />;
  }

  const createNewThresholdGroup = () => {
    if (selectedProjects.length === 1) {
      setNewThresholdGroup([
        ...newThresholdGroup,
        {
          id: `${NEW_GROUP_PREFIX}-${newGroupIterator}`,
          project: selectedProjects[0],
          environments: getAllEnvironments(),
        },
      ]);
      setNewGroupIterator(newGroupIterator + 1);
    } else {
      tempError('Must select a single project in order to create a new threshold');
    }
  };

  const onNewGroupFinished = id => {
    const newGroups = newThresholdGroup.filter(group => group.id !== id);
    setNewThresholdGroup(newGroups);
  };

  return (
    <PageFiltersContainer>
      <NoProjectMessage organization={organization}>
        <Header
          router={router}
          hasV2ReleaseUIEnabled
          newThresholdAction={createNewThresholdGroup}
          newThresholdDisabled={selection.projects.length !== 1}
        />
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
            <StyledPanelTable
              isLoading={isLoading}
              isEmpty={
                filteredThresholds.length === 0 &&
                newThresholdGroup.length === 0 &&
                !isError
              }
              emptyMessage={t('No thresholds found.')}
              headers={[
                t('Project Name'),
                t('Environment'),
                t('Window'),
                t('Condition'),
                t(' '),
              ]}
            >
              {thresholdGroups &&
                Object.entries(thresholdGroups).map(([projId, byEnv]) => {
                  return Object.entries(byEnv).map(([envName, thresholdGroup]) => (
                    <ThresholdGroupRows
                      key={`${projId}-${envName}`}
                      thresholds={thresholdGroup}
                      refetch={refetch}
                      orgSlug={organization.slug}
                      setError={tempError}
                    />
                  ));
                })}
              {selectedProjects.length === 1 &&
                newThresholdGroup[0] &&
                newThresholdGroup
                  .filter(group => group.project === selectedProjects[0])
                  .map(group => (
                    <ThresholdGroupRows
                      key={group.id}
                      newGroup={group}
                      refetch={refetch}
                      orgSlug={organization.slug}
                      setError={tempError}
                      onFormClose={onNewGroupFinished}
                    />
                  ))}
            </StyledPanelTable>
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

const StyledPanelTable = styled(PanelTable)`
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    overflow: initial;
  }

  grid-template-columns:
    minmax(100px, 1fr) minmax(100px, 1fr) minmax(250px, 1fr) minmax(200px, 4fr)
    minmax(150px, auto);
  white-space: nowrap;
  font-size: ${p => p.theme.fontSizeMedium};
  > * {
    border-bottom: inherit;
  }
  > *:last-child {
    > *:last-child {
      border-radius: 0 0 ${p => p.theme.borderRadius} 0;
      border-bottom: 0;
    }
  }
`;

const ReleaseThresholdsPageFilterBar = styled(PageFilterBar)`
  margin-bottom: ${space(2)};
`;
