import {useCallback, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import useDrawer from 'sentry/components/globalDrawer';
import {ScrollCarousel} from 'sentry/components/scrollCarousel';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useProjects from 'sentry/utils/useProjects';
import ThemeCard from 'sentry/views/issueList/pages/missionControl/components/themeCard';
import {ThemeDrawer} from 'sentry/views/issueList/pages/missionControl/components/themeDrawer';
import {useProjectSelection} from 'sentry/views/issueList/pages/missionControl/projectContext';
import type {
  ThemeCardData,
  Ultragroup,
} from 'sentry/views/issueList/pages/missionControl/types';

// Import cluster summaries data
import clusterSummariesData from './cluster_summaries_v6b.json';

// Transform cluster summaries data to match Ultragroup interface
function transformClusterSummariesToUltragroups(data: any[]): Ultragroup[] {
  return data.map(cluster => ({
    id: `cluster-${cluster.cluster_id}`,
    title: cluster.title,
    description: cluster.description,
    issueIds: cluster.group_ids.map((id: number) => id.toString()),
  }));
}

function CoreProblemsSection() {
  const {selectedProjects} = useProjectSelection();
  const {projects} = useProjects();
  const {openDrawer} = useDrawer();
  const location = useLocation();
  const navigate = useNavigate();

  // Get the first selected project (core problems are project-specific)
  const currentProject = useMemo(() => {
    if (selectedProjects.length > 0 && projects.length > 0) {
      return projects.find(p => p.id === selectedProjects[0]?.toString());
    }
    return projects?.[0]; // Fallback to first project if none selected
  }, [selectedProjects, projects]);

  // Load core problems data from cluster summaries JSON
  const coreProblemsData: ThemeCardData[] = useMemo(() => {
    // Filter clusters by project selection and minimum group count
    const filteredClusters = clusterSummariesData.filter(cluster => {
      // Only include clusters with at least 2 group IDs
      if (cluster.group_ids.length < 2) {
        return false;
      }

      // If no projects selected, show all clusters
      if (selectedProjects.length === 0) {
        return true;
      }

      // Filter by selected project - check if cluster contains any selected project
      const selectedProjectStrings = selectedProjects.map(id => id.toString());
      return cluster.project_ids.some(projectId =>
        selectedProjectStrings.includes(projectId.toString())
      );
    });

    const ultragroups = transformClusterSummariesToUltragroups(filteredClusters);

    // Map to ThemeCardData and sort by issue count (descending)
    return ultragroups
      .map(ultragroup => ({
        ultragroup,
        issueCount: ultragroup.issueIds.length,
        totalEvents: 0, // Not used, but required by interface
      }))
      .sort((a, b) => b.issueCount - a.issueCount);
  }, [selectedProjects]);

  const openCoreProblemsDrawer = useCallback(
    (themeData: ThemeCardData) => {
      if (!currentProject) {
        return;
      }

      openDrawer(
        () => <ThemeDrawer data={themeData} project={currentProject} isCoreProblem />,
        {
          ariaLabel: t('Core Problem Details'),
          drawerKey: 'core-problems-details',
          drawerWidth: '50%',
          onClose: () => {
            navigate({
              pathname: location.pathname,
              query: {
                ...location.query,
                coreProblemsDrawer: undefined,
              },
            });
          },
        }
      );
    },
    [openDrawer, currentProject, location, navigate]
  );

  // Open drawer when URL param is present
  useEffect(() => {
    const problemId = location.query.coreProblemsDrawer;
    if (problemId && currentProject) {
      const problemData = coreProblemsData.find(
        problem => problem.ultragroup.id === problemId
      );
      if (problemData) {
        openCoreProblemsDrawer(problemData);
      }
    }
  }, [
    location.query.coreProblemsDrawer,
    currentProject,
    coreProblemsData,
    openCoreProblemsDrawer,
  ]);

  const handleCardClick = (problemData: ThemeCardData) => {
    navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        coreProblemsDrawer: problemData.ultragroup.id,
      },
    });
  };

  if (coreProblemsData.length === 0) {
    return (
      <Container>
        <EmptyStateWarning>
          <p>{t('No core problems detected.')}</p>
          <p>
            {t('Core problems will appear here when critical issues are identified.')}
          </p>
        </EmptyStateWarning>
      </Container>
    );
  }

  return (
    <Container>
      <ScrollCarousel aria-label={t('Core problems')}>
        {coreProblemsData.map((problem, index) => (
          <ThemeCard
            key={problem.ultragroup.id || index}
            data={problem}
            onClick={() => handleCardClick(problem)}
            isCoreProblem
          />
        ))}
      </ScrollCarousel>
    </Container>
  );
}

const Container = styled('div')``;

export default CoreProblemsSection;
