import {Fragment, useEffect} from 'react';
import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import hero from 'sentry-images/stories/landing/hero.png';

import {Button} from 'sentry/components/core/button';
import {Link} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {IconIssues, IconOpen} from 'sentry/icons';
import {IconSeer} from 'sentry/icons/iconSeer';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MissionControlCard} from 'sentry/types/missionControl';
import useOrganization from 'sentry/utils/useOrganization';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import {
  ProjectSelectionProvider,
  useProjectSelection,
} from 'sentry/views/issueList/pages/missionControl/projectContext';
import AssignedToMeSection from 'sentry/views/issueList/pages/missionControl/sections/assignedToMeSection';
import CoreProblemsSection from 'sentry/views/issueList/pages/missionControl/sections/coreProblemsSection';
import EscalatingIssuesSection from 'sentry/views/issueList/pages/missionControl/sections/escalatingIssuesSection';
import NewIssuesSection from 'sentry/views/issueList/pages/missionControl/sections/newIssuesSection';
import ThemesSection from 'sentry/views/issueList/pages/missionControl/sections/themesSection';
import TopIssuesSection from 'sentry/views/issueList/pages/missionControl/sections/topIssuesSection';

// Wobble animation to grab attention
const wobble = keyframes`
  0% { transform: rotate(0deg); }
  15% { transform: rotate(1deg); }
  30% { transform: rotate(-1deg); }
  45% { transform: rotate(0.5deg); }
  60% { transform: rotate(-0.5deg); }
  75% { transform: rotate(0.25deg); }
  100% { transform: rotate(0deg); }
`;

interface HomeScreenProps {
  cards: MissionControlCard[];
  onOpenCards: () => void;
}

// Helper function to create issue stream URLs with queries
function createIssueStreamUrl(
  organization: any,
  query: string,
  sort: string,
  projects?: number[]
): LocationDescriptor {
  return {
    pathname: `/organizations/${organization.slug}/issues/`,
    query: {
      query,
      sort,
      referrer: 'mission-control',
      ...(projects && projects.length > 0 ? {project: projects} : {}),
    },
  };
}

// Component that contains the sections with their action buttons
function MissionControlSections() {
  const organization = useOrganization();
  const {selectedProjects} = useProjectSelection();

  const createViewAllButton = (query: string, sort: string, label: string) => (
    <Link to={createIssueStreamUrl(organization, query, sort, selectedProjects)}>
      <Button
        size="xs"
        icon={<IconOpen />}
        aria-label={`View all ${label.toLowerCase()}`}
      >
        {t('View All')}
      </Button>
    </Link>
  );

  return (
    <Fragment>
      <FoldSection
        sectionKey={SectionKey.SEER_MISSION_CONTROL_CORE_PROBLEMS}
        title={t('Core Problems')}
        disableCollapsePersistence
      >
        <CoreProblemsSection />
      </FoldSection>
      <FoldSection
        sectionKey={SectionKey.SEER_MISSION_CONTROL_THEMES}
        title={t('Themes')}
        disableCollapsePersistence
      >
        <ThemesSection />
      </FoldSection>
      <FoldSection
        sectionKey={SectionKey.SEER_MISSION_CONTROL_ESCALATING_ISSUES}
        title={t('Escalating Issues')}
        actions={createViewAllButton(
          'is:unresolved is:escalating',
          'date',
          'Escalating Issues'
        )}
      >
        <EscalatingIssuesSection />
      </FoldSection>
      <FoldSection
        sectionKey={SectionKey.SEER_MISSION_CONTROL_NEW_ISSUES}
        title={t('New Issues')}
        actions={createViewAllButton('is:unresolved is:new', 'date', 'New Issues')}
      >
        <NewIssuesSection />
      </FoldSection>
      <FoldSection
        sectionKey={SectionKey.SEER_MISSION_CONTROL_TOP_ISSUES}
        title={t('Frequent Issues')}
        actions={createViewAllButton('', 'freq', 'Frequent Issues')}
      >
        <TopIssuesSection />
      </FoldSection>
      <FoldSection
        sectionKey={SectionKey.SEER_MISSION_CONTROL_ASSIGNED_TO_ME}
        title={t('Assigned to Me')}
        actions={createViewAllButton(
          'assigned:[me] is:unresolved',
          'date',
          'Assigned to Me'
        )}
      >
        <AssignedToMeSection />
      </FoldSection>
    </Fragment>
  );
}

function HomeScreen({cards, onOpenCards}: HomeScreenProps) {
  // Keyboard support for Enter key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (event.target && (event.target as HTMLElement).tagName === 'INPUT') {
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        onOpenCards();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onOpenCards]);

  return (
    <HomeScreenContainer>
      <HeroSection>
        <HeroImageContainer>
          <HeroImage src={hero} alt="background-image" />
        </HeroImageContainer>

        <HeroContent>
          <SeerIconContainer>
            <IconSeer variant="waiting" size="xl" />
          </SeerIconContainer>

          <CardStackPreviewContainer
            onClick={onOpenCards}
            tabIndex={0}
            role="button"
            aria-label="Open card stack to review items"
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onOpenCards();
              }
            }}
          >
            <CardStackPreview>
              <CardPreviewBack />
              <CardPreviewFront>
                <IconIssues size="lg" color="active" />
                <Text size="lg" bold>
                  {cards.length} item{cards.length === 1 ? '' : 's'} to review
                </Text>
                <KeyHint>↵</KeyHint>
              </CardPreviewFront>
            </CardStackPreview>
          </CardStackPreviewContainer>
        </HeroContent>
      </HeroSection>

      <ProjectSelectionProvider>
        <ProjectFilterContainer>
          <ProjectPageFilter size="sm" />
        </ProjectFilterContainer>

        <Body>
          <MissionControlSections />
        </Body>
      </ProjectSelectionProvider>
    </HomeScreenContainer>
  );
}

const HomeScreenContainer = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  width: 100%;
  gap: ${space(4)};
  margin: ${space(4)};
  margin-top: 0;
  padding-left: ${space(2)};
  padding-right: ${space(2)};
`;

const HeroSection = styled('div')`
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${space(4)};
  padding: ${space(4)} ${space(2)};
  border-radius: ${p => p.theme.borderRadius};
`;

const HeroImageContainer = styled('div')`
  position: absolute;
  top: 0%;
  left: 0%;
  z-index: -1;
  width: 80%;
  transform: translate(10%, 0%);
`;

const HeroImage = styled('img')`
  width: 100%;
  height: auto;
  display: block;
`;

const HeroContent = styled('div')`
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${space(4)};
  width: 100%;
  margin-top: ${space(4)};
`;

const SeerIconContainer = styled('div')`
  display: flex;
  justify-content: center;
`;

const CardStackPreviewContainer = styled('div')`
  cursor: pointer;
  position: relative;
  border-radius: ${p => p.theme.borderRadius};
  transition: outline 0.2s ease-in-out;

  &:focus {
    outline: 2px solid ${p => p.theme.focus};
    outline-offset: 4px;
  }

  &:focus:not(:focus-visible) {
    outline: none;
  }
`;

const CardStackPreview = styled('div')`
  position: relative;
  width: 400px;
  max-width: 100%;
  animation: ${wobble} 2s ease-in-out infinite;
  animation-delay: 1s;
`;

const CardPreviewBack = styled('div')`
  position: absolute;
  top: -8px;
  left: 4px;
  right: -4px;
  height: 120px;
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  transform: rotate(2deg);
  z-index: 1;

  transition:
    transform 0.2s ease-in-out,
    background 0.2s ease-in-out;

  &:hover {
    transform: rotate(4deg);
    background: ${p => p.theme.backgroundSecondary};
  }
`;

const CardPreviewFront = styled('div')`
  position: relative;
  height: 120px;
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: ${p => p.theme.dropShadowMedium};
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  gap: ${space(2)};
  transform: rotate(-2deg);
  transition:
    transform 0.2s ease-in-out,
    background 0.2s ease-in-out;

  &:hover {
    transform: rotate(-4deg);
    background: ${p => p.theme.backgroundSecondary};
  }
`;

const Body = styled('div')`
  width: 100%;
  background-color: ${p => p.theme.background};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1)};
  box-shadow: ${p => p.theme.dropShadowMedium};
  border: 1px solid ${p => p.theme.border};
`;

const ProjectFilterContainer = styled('div')`
  display: flex;
  align-items: center;
  width: 100%;
  justify-content: flex-start;
  margin-bottom: -${space(3)};
`;

const KeyHint = styled('span')`
  margin-top: ${space(0.5)};
`;

export default HomeScreen;
