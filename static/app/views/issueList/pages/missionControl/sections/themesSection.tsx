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

// Mock data for now - in the future this would come from an API endpoint
const MOCK_ULTRAGROUPS: Ultragroup[] = [
  {
    id: 'ug-1',
    title: 'Database Connection Timeouts',
    description:
      'A cluster of issues related to database connectivity problems causing timeouts and connection pool exhaustion across multiple services.',
    issueIds: [
      '6814613109',
      '6806096924',
      '6777178309',
      '6812035225',
      '6535361540',
      '6312346126',
      '6811125385',
      '6807026932',
      '6580216454',
    ],
  },
  {
    id: 'ug-2',
    title: 'Frontend JavaScript Errors',
    description:
      'React component lifecycle errors and undefined variable references causing user-facing issues in the web application.',
    issueIds: ['6105857349', '6652211379', '6817442236'],
  },
  {
    id: 'ug-3',
    title: 'API Rate Limiting Issues',
    description:
      'Third-party API rate limits being exceeded, causing failed requests and degraded user experience during peak hours.',
    issueIds: ['6800373349', '6793968470', '6792450203', '6782679792'],
  },
  {
    id: 'ug-4',
    title: 'Memory Leak Patterns',
    description:
      'Gradual memory consumption increases in background processes leading to out-of-memory errors and service restarts.',
    issueIds: ['6810613067', '6810613041'],
  },
  {
    id: 'ug-5',
    title: 'Authentication Flow Errors',
    description:
      'OAuth and session management issues causing login failures and unexpected logouts for users across different platforms.',
    issueIds: ['6616863248', '6725522988', '6592963812', '6600813899', '5456263989'],
  },
];

function ThemesSection() {
  const {selectedProjects} = useProjectSelection();
  const {projects} = useProjects();
  const {openDrawer} = useDrawer();
  const location = useLocation();
  const navigate = useNavigate();

  // Get the first selected project (themes are project-specific)
  const currentProject = useMemo(() => {
    if (selectedProjects.length > 0 && projects.length > 0) {
      return projects.find(p => p.id === selectedProjects[0]?.toString());
    }
    return projects?.[0]; // Fallback to first project if none selected
  }, [selectedProjects, projects]);

  // For now, use static mock data with realistic counts
  // In the future, this would fetch from a real API endpoint
  const mockThemeData: ThemeCardData[] = useMemo(() => {
    // Static event counts for consistent demo experience
    const eventCounts = [3247, 1892, 4156, 876, 5429];

    return MOCK_ULTRAGROUPS.map((ultragroup, index) => ({
      ultragroup,
      issueCount: ultragroup.issueIds.length,
      totalEvents: eventCounts[index] || 1000,
    }));
  }, []);

  const openThemeDrawer = useCallback(
    (themeData: ThemeCardData) => {
      if (!currentProject) {
        return;
      }

      openDrawer(() => <ThemeDrawer data={themeData} project={currentProject} />, {
        ariaLabel: t('Theme Details'),
        drawerKey: 'theme-details',
        drawerWidth: '50%',
        onClose: () => {
          navigate({
            pathname: location.pathname,
            query: {
              ...location.query,
              themeDrawer: undefined,
            },
          });
        },
      });
    },
    [openDrawer, currentProject, location, navigate]
  );

  // Open drawer when URL param is present
  useEffect(() => {
    const themeId = location.query.themeDrawer;
    if (themeId && currentProject) {
      const themeData = mockThemeData.find(theme => theme.ultragroup.id === themeId);
      if (themeData) {
        openThemeDrawer(themeData);
      }
    }
  }, [location.query.themeDrawer, currentProject, mockThemeData, openThemeDrawer]);

  const handleCardClick = (themeCardData: ThemeCardData) => {
    navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        themeDrawer: themeCardData.ultragroup.id,
      },
    });
  };

  if (mockThemeData.length === 0) {
    return (
      <Container>
        <EmptyStateWarning>
          <p>{t('No issue themes detected.')}</p>
          <p>{t('Themes will appear here when related issues are identified.')}</p>
        </EmptyStateWarning>
      </Container>
    );
  }

  return (
    <Container>
      <ScrollCarousel aria-label={t('Issue themes')}>
        {mockThemeData.map((theme, index) => (
          <ThemeCard
            key={theme.ultragroup.id || index}
            data={theme}
            onClick={() => handleCardClick(theme)}
          />
        ))}
      </ScrollCarousel>
    </Container>
  );
}

const Container = styled('div')``;

export default ThemesSection;
