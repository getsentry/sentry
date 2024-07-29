import {useEffect, useMemo} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import qs from 'qs';

import connectDotsImg from 'sentry-images/spot/performance-connect-dots.svg';

import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import ExternalLink from 'sentry/components/links/externalLink';
import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import {withPerformanceOnboarding} from 'sentry/data/platformCategories';
import {IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import useDismissAlert from 'sentry/utils/useDismissAlert';
import useProjects from 'sentry/utils/useProjects';

import {traceAnalytics} from '../traceAnalytics';
import type {TraceTree} from '../traceModels/traceTree';
import {TraceType} from '../traceType';

type OnlyOrphanErrorWarningsProps = {
  organization: Organization;
  traceSlug: string | undefined;
  tree: TraceTree;
};

function filterProjects(projects: Project[], tree: TraceTree) {
  const projectsWithNoPerformance: Project[] = [];
  const projectsWithOnboardingChecklist: Project[] = [];

  for (const project of projects) {
    if (tree.project_ids.has(Number(project.id))) {
      if (!project.firstTransactionEvent) {
        projectsWithNoPerformance.push(project);
        if (project.platform && withPerformanceOnboarding.has(project.platform)) {
          projectsWithOnboardingChecklist.push(project);
        }
      }
    }
  }

  return {projectsWithNoPerformance, projectsWithOnboardingChecklist};
}

export function PerformanceSetupWarning({
  traceSlug,
  tree,
  organization,
}: OnlyOrphanErrorWarningsProps) {
  const {projects} = useProjects();

  const {projectsWithNoPerformance, projectsWithOnboardingChecklist} = useMemo(() => {
    return filterProjects(projects, tree);
  }, [projects, tree]);

  const LOCAL_STORAGE_KEY = `${traceSlug}:performance-orphan-error-onboarding-banner-hide`;

  useEffect(() => {
    if (
      projectsWithOnboardingChecklist.length > 0 &&
      location.hash === '#performance-sidequest'
    ) {
      SidebarPanelStore.activatePanel(SidebarPanelKey.PERFORMANCE_ONBOARDING);
    }
  }, [projectsWithOnboardingChecklist]);

  const {dismiss: snooze, isDismissed: isSnoozed} = useDismissAlert({
    key: LOCAL_STORAGE_KEY,
    expirationDays: 7,
  });

  const {dismiss, isDismissed} = useDismissAlert({
    key: LOCAL_STORAGE_KEY,
    expirationDays: 365,
  });

  if (
    tree.type !== 'trace' ||
    tree.shape !== TraceType.ONLY_ERRORS ||
    projectsWithNoPerformance.length === 0
  ) {
    return null;
  }

  if (projectsWithOnboardingChecklist.length === 0) {
    return (
      <Alert type="info" showIcon>
        {tct(
          "Some of the projects associated with this trace don't support performance monitoring. To learn more about how to setup performance monitoring, visit our [documentation].",
          {
            documentationLink: (
              <ExternalLink href="https://docs.sentry.io/product/performance/getting-started/">
                {t('documentation')}
              </ExternalLink>
            ),
          }
        )}
      </Alert>
    );
  }

  if (isDismissed || isSnoozed) {
    return null;
  }

  return (
    <BannerWrapper>
      <ActionsWrapper>
        <BannerTitle>{t('Your setup is incomplete')}</BannerTitle>
        <BannerDescription>
          {t(
            "Want to know why this string of errors happened? Configure performance monitoring to get a full picture of what's going on."
          )}
        </BannerDescription>
        <ButtonsWrapper>
          <ActionButton>
            <Button
              priority="primary"
              onClick={event => {
                event.preventDefault();
                traceAnalytics.trackPerformanceSetupChecklistTriggered(organization);
                browserHistory.replace({
                  pathname: location.pathname,
                  query: {
                    ...qs.parse(location.search),
                    project: projectsWithOnboardingChecklist.map(project => project.id),
                  },
                  hash: '#performance-sidequest',
                });
                SidebarPanelStore.activatePanel(SidebarPanelKey.PERFORMANCE_ONBOARDING);
              }}
            >
              {t('Start Checklist')}
            </Button>
          </ActionButton>
          <ActionButton>
            <Button
              onClick={() =>
                traceAnalytics.trackPerformanceSetupLearnMoreClicked(organization)
              }
              href="https://docs.sentry.io/product/performance/"
              external
            >
              {t('Learn More')}
            </Button>
          </ActionButton>
        </ButtonsWrapper>
      </ActionsWrapper>
      {<Background image={connectDotsImg} />}
      <CloseDropdownMenu
        position="bottom-end"
        triggerProps={{
          showChevron: false,
          borderless: true,
          icon: <IconClose color="subText" />,
        }}
        size="xs"
        items={[
          {
            key: 'dismiss',
            label: t('Dismiss'),
            onAction: () => {
              dismiss();
            },
          },
          {
            key: 'snooze',
            label: t('Snooze'),
            onAction: () => {
              snooze();
            },
          },
        ]}
      />
    </BannerWrapper>
  );
}

const BannerWrapper = styled('div')`
  position: relative;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(2)} ${space(3)};
  margin-bottom: ${space(2)};
  background: linear-gradient(
    90deg,
    ${p => p.theme.backgroundSecondary}00 0%,
    ${p => p.theme.backgroundSecondary}FF 70%,
    ${p => p.theme.backgroundSecondary}FF 100%
  );
  container-type: inline-size;
`;

const ActionsWrapper = styled('div')`
  max-width: 50%;
`;

const ButtonsWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const BannerTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin-bottom: ${space(1)};
  font-weight: ${p => p.theme.fontWeightBold};
`;

const BannerDescription = styled('div')`
  margin-bottom: ${space(1.5)};
`;

const CloseDropdownMenu = styled(DropdownMenu)`
  position: absolute;
  display: block;
  top: ${space(1)};
  right: ${space(1)};
  color: ${p => p.theme.white};
  cursor: pointer;
  z-index: 1;
`;

const Background = styled('div')<{image: any}>`
  display: flex;
  justify-self: flex-end;
  position: absolute;
  top: 14px;
  right: 15px;
  height: 81%;
  width: 100%;
  max-width: 413px;
  background-image: url(${p => p.image});
  background-repeat: no-repeat;
  background-size: contain;

  @container (max-width: 840px) {
    display: none;
  }
`;

const ActionButton = styled('div')`
  display: flex;
  gap: ${space(1)};
`;
