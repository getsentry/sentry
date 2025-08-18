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

// Mock data for core problems - in the future this would come from an API endpoint
const MOCK_CORE_PROBLEMS: Ultragroup[] = [
  {
    id: 'cp-1',
    title: 'Autofix agent is hammering Postgres',
    description:
      'The Autofix agent makes tons of db requests while streaming, overloading the database and causing connection errors throughout the process at different points.',
    issueIds: [
      '6814613109',
      '6806096924',
      '6777178309',
      '6812035225',
      '6535361540',
      '6312346126',
    ],
  },
  {
    id: 'cp-2',
    title: 'Replay AI features not checking consent on client',
    description:
      'Replay breadcrumb and feedback summaries are not checking consent on the Sentry side, so they raise errors on the Seer side.',
    issueIds: ['6105857349', '6652211379', '6817442236', '6800373349'],
  },
  {
    id: 'cp-3',
    title: 'Gemini intermittently fails structured output',
    description:
      'Structured output requests to Gemini sometimes return nothing despite the retry mechanism, causing unhandled errors in Autofix, issue summary, and more.',
    issueIds: ['6793968470', '6792450203', '6782679792'],
  },
];

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

  // For now, use static mock data with realistic counts
  // In the future, this would fetch from a real API endpoint
  const mockCoreProblemsData: ThemeCardData[] = useMemo(() => {
    // Higher event counts for core problems since they're more severe
    const eventCounts = [8934, 5672, 3241, 7189];

    return MOCK_CORE_PROBLEMS.map((ultragroup, index) => ({
      ultragroup,
      issueCount: ultragroup.issueIds.length,
      totalEvents: eventCounts[index] || 2000,
    }));
  }, []);

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
      const problemData = mockCoreProblemsData.find(
        problem => problem.ultragroup.id === problemId
      );
      if (problemData) {
        openCoreProblemsDrawer(problemData);
      }
    }
  }, [
    location.query.coreProblemsDrawer,
    currentProject,
    mockCoreProblemsData,
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

  if (mockCoreProblemsData.length === 0) {
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
        {mockCoreProblemsData.map((problem, index) => (
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
