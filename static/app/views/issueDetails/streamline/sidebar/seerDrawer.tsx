import {Fragment, useCallback, useEffect, useRef} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import {AiPrivacyNotice} from 'sentry/components/aiPrivacyTooltip';
import {Breadcrumbs as NavigationBreadcrumbs} from 'sentry/components/breadcrumbs';
import {ProjectAvatar} from 'sentry/components/core/avatar/projectAvatar';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex, Stack} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import {DateTime} from 'sentry/components/dateTime';
import AutofixFeedback from 'sentry/components/events/autofix/autofixFeedback';
import {AutofixStartBox} from 'sentry/components/events/autofix/autofixStartBox';
import {AutofixSteps} from 'sentry/components/events/autofix/autofixSteps';
import {AutofixStepType} from 'sentry/components/events/autofix/types';
import {useAiAutofix} from 'sentry/components/events/autofix/useAutofix';
import {AutofixConfigureSeer} from 'sentry/components/events/autofix/v2/autofixConfigureSeer';
import {ExplorerSeerDrawer} from 'sentry/components/events/autofix/v2/explorerSeerDrawer';
import useDrawer from 'sentry/components/globalDrawer';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import {GroupSummary} from 'sentry/components/group/groupSummary';
import HookOrDefault from 'sentry/components/hookOrDefault';
import Placeholder from 'sentry/components/placeholder';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconSettings} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getShortEventId} from 'sentry/utils/events';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useSeerOnboardingCheck} from 'sentry/utils/useSeerOnboardingCheck';
import {MIN_NAV_HEIGHT} from 'sentry/views/issueDetails/streamline/eventTitle';
import {useAiConfig} from 'sentry/views/issueDetails/streamline/hooks/useAiConfig';
import {SeerNotices} from 'sentry/views/issueDetails/streamline/sidebar/seerNotices';

interface SeerDrawerProps {
  event: Event;
  group: Group;
  project: Project;
}

const AiSetupConfiguration = HookOrDefault({
  hookName: 'component:ai-setup-configuration',
  defaultComponent: ({
    event,
    group,
    project,
  }: {
    event: Event;
    group: Group;
    project: Project;
  }) => <AutofixConfigureSeer event={event} group={group} project={project} />,
});

const AiSetupDataConsent = HookOrDefault({
  hookName: 'component:ai-setup-data-consent',
  defaultComponent: () => <div data-test-id="ai-setup-data-consent" />,
});

function WelcomeScreen({
  group,
  project,
  event,
}: {
  event: Event;
  group: Group;
  project: Project;
}) {
  const organization = useOrganization();
  const skipConsentFlow = organization.features.includes('gen-ai-consent-flow-removal');

  return (
    <Stack gap="2xl">
      {skipConsentFlow && (
        <StyledCard>
          <GroupSummary group={group} event={event} project={project} />
        </StyledCard>
      )}
      <AiSetupDataConsent groupId={group.id} />
    </Stack>
  );
}

export function SeerDrawer({group, project, event}: SeerDrawerProps) {
  const organization = useOrganization();
  const aiConfig = useAiConfig(group, project);
  const seerOnboardingCheck = useSeerOnboardingCheck();

  const seatBasedSeer = organization.features.includes('seat-based-seer-enabled');

  // Handle loading state at the top level
  if (
    aiConfig.isAutofixSetupLoading ||
    (seatBasedSeer && seerOnboardingCheck.isPending)
  ) {
    return (
      <SeerDrawerContainer className="seer-drawer-container">
        <SeerDrawerHeader>
          <NavigationCrumbs
            crumbs={[
              {
                label: (
                  <Flex align="center" gap="md">
                    <ProjectAvatar project={project} />
                    <ShortId>{group.shortId}</ShortId>
                  </Flex>
                ),
              },
              {label: getShortEventId(event.id)},
              {label: t('Seer')},
            ]}
          />
        </SeerDrawerHeader>
        <SeerDrawerBody>
          <PlaceholderStack data-test-id="ai-setup-loading-indicator">
            <Placeholder height="10rem" />
            <Placeholder height="15rem" />
            <Placeholder height="15rem" />
          </PlaceholderStack>
        </SeerDrawerBody>
      </SeerDrawerContainer>
    );
  }

  const noAutofixQuota =
    !aiConfig.hasAutofixQuota && organization.features.includes('seer-billing');

  if (seatBasedSeer) {
    // No easy way to add a hook for only configuring quotas.
    // So the condition here captures all the possible cases
    // that requires some kind of configuration change.
    //
    // Instead, we bundle all the configuration into 1 hook.
    //
    // If the hook is not defined, we always direct them to
    // the seer configs.
    //
    // If the hook is defined, the hook will render a different
    // component as needed to configure quotas.
    if (
      // needs to configure quota
      noAutofixQuota ||
      // needs to configure repos
      !aiConfig.seerReposLinked ||
      // needs to have autofix enabled for this group's project
      !aiConfig.autofixEnabled ||
      // needs to enable autofix
      !seerOnboardingCheck.data?.isAutofixEnabled ||
      // catch all, ensure seer is configured
      !seerOnboardingCheck.data?.isSeerConfigured
    ) {
      return (
        <SeerDrawerContainer className="seer-drawer-container">
          <SeerDrawerHeader>
            <NavigationCrumbs
              crumbs={[
                {
                  label: (
                    <Flex align="center" gap="md">
                      <ProjectAvatar project={project} />
                      <ShortId>{group.shortId}</ShortId>
                    </Flex>
                  ),
                },
                {label: getShortEventId(event.id)},
                {label: t('Seer')},
              ]}
            />
          </SeerDrawerHeader>
          <SeerDrawerBody>
            <AiSetupConfiguration event={event} group={group} project={project} />
          </SeerDrawerBody>
        </SeerDrawerContainer>
      );
    }
  } else if (
    // Handle welcome/consent screen at the top level
    aiConfig.orgNeedsGenAiAcknowledgement ||
    noAutofixQuota
  ) {
    return (
      <SeerDrawerContainer className="seer-drawer-container">
        <SeerDrawerHeader>
          <NavigationCrumbs
            crumbs={[
              {
                label: (
                  <Flex align="center" gap="md">
                    <ProjectAvatar project={project} />
                    <ShortId>{group.shortId}</ShortId>
                  </Flex>
                ),
              },
              {label: getShortEventId(event.id)},
              {label: t('Seer')},
            ]}
          />
        </SeerDrawerHeader>
        <SeerDrawerBody>
          <WelcomeScreen group={group} project={project} event={event} />
        </SeerDrawerBody>
      </SeerDrawerContainer>
    );
  }

  // Route to Explorer-based drawer if both feature flags are enabled
  if (
    organization.features.includes('seer-explorer') &&
    organization.features.includes('autofix-on-explorer')
  ) {
    return (
      <ExplorerSeerDrawer
        group={group}
        project={project}
        event={event}
        aiConfig={aiConfig}
      />
    );
  }

  return (
    <LegacySeerDrawer group={group} project={project} event={event} aiConfig={aiConfig} />
  );
}

interface LegacySeerDrawerProps extends SeerDrawerProps {
  aiConfig: ReturnType<typeof useAiConfig>;
}

function LegacySeerDrawer({group, project, event, aiConfig}: LegacySeerDrawerProps) {
  const organization = useOrganization();
  const {
    autofixData,
    triggerAutofix,
    reset,
    isPending: autofixDataPending,
  } = useAiAutofix(group, event);
  const location = useLocation();
  const navigate = useNavigate();

  useRouteAnalyticsParams({autofix_status: autofixData?.status ?? 'none'});

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(true);
  const lastScrollTopRef = useRef(0);
  const autofixDataRef = useRef(autofixData);

  useEffect(() => {
    autofixDataRef.current = autofixData;
  }, [autofixData]);

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    // Detect scroll direction
    const scrollingUp = container.scrollTop < lastScrollTopRef.current;
    lastScrollTopRef.current = container.scrollTop;

    // Check if we're at the bottom
    const isAtBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 1;

    // Disable auto-scroll if scrolling up
    if (scrollingUp) {
      userScrolledRef.current = true;
    }

    // Re-enable auto-scroll if we reach the bottom
    if (isAtBottom) {
      userScrolledRef.current = false;
    }
  };

  const scrollToSection = useCallback(
    (sectionType: string | null) => {
      if (!scrollContainerRef.current || !autofixDataRef.current) {
        return;
      }

      const findStepByType = (type: string) => {
        const currentData = autofixDataRef.current;
        if (!currentData?.steps?.length) {
          return null;
        }
        const step = currentData.steps.find(s => {
          if (type === 'root_cause')
            return s.type === AutofixStepType.ROOT_CAUSE_ANALYSIS;
          if (type === 'solution') return s.type === AutofixStepType.SOLUTION;
          if (type === 'code_changes') return s.type === AutofixStepType.CHANGES;
          return false;
        });
        return step;
      };

      if (sectionType) {
        const step = findStepByType(sectionType);
        if (step) {
          const elementId = `autofix-step-${step.id}`;
          const element = document.getElementById(elementId);
          if (element) {
            element.scrollIntoView({behavior: 'smooth'});
            userScrolledRef.current = true;

            // Clear the scrollTo parameter from the URL after scrolling
            setTimeout(() => {
              navigate(
                {
                  pathname: location.pathname,
                  query: {
                    ...location.query,
                    scrollTo: undefined,
                  },
                },
                {replace: true}
              );
            }, 200);
          }
        } else {
          // No matching step found, scroll to bottom
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
          userScrolledRef.current = true;

          // Clear the scrollTo parameter from the URL after scrolling
          setTimeout(() => {
            navigate(
              {
                pathname: location.pathname,
                query: {
                  ...location.query,
                  scrollTo: undefined,
                },
              },
              {replace: true}
            );
          }, 200);
        }
      }
    },
    [location, navigate]
  );

  useEffect(() => {
    // Only auto-scroll if user hasn't manually scrolled
    if (!userScrolledRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [autofixData]);

  useEffect(() => {
    const scrollTo = location.query.scrollTo as string | undefined;
    if (scrollTo) {
      const timeoutId = setTimeout(() => {
        scrollToSection(scrollTo);
      }, 100);
      return () => clearTimeout(timeoutId);
    }
    return () => {};
  }, [location.query.scrollTo, scrollToSection]);

  let lastTriggeredAt = autofixData?.last_triggered_at;
  if (lastTriggeredAt && !lastTriggeredAt.endsWith('Z')) {
    lastTriggeredAt = lastTriggeredAt + 'Z';
  }

  return (
    <SeerDrawerContainer className="seer-drawer-container">
      <SeerDrawerHeader>
        <NavigationCrumbs
          crumbs={[
            {
              label: (
                <Flex align="center" gap="md">
                  <ProjectAvatar project={project} />
                  <ShortId>{group.shortId}</ShortId>
                </Flex>
              ),
            },
            {label: getShortEventId(event.id)},
            {label: t('Seer')},
          ]}
        />
        <FeedbackWrapper>
          <AutofixFeedback />
        </FeedbackWrapper>
      </SeerDrawerHeader>
      <SeerDrawerNavigator>
        <Flex align="center" gap="md">
          <Header>{t('Seer')}</Header>
          <QuestionTooltip
            isHoverable
            title={
              <Flex direction="column" gap="md">
                <div>
                  <AiPrivacyNotice />
                </div>
                <div>
                  {tct('Seer can be turned off in [settingsDocs:Settings].', {
                    settingsDocs: (
                      <Link
                        to={{
                          pathname: `/settings/${organization.slug}/`,
                          hash: 'hideAiFeatures',
                        }}
                      />
                    ),
                  })}
                </div>
              </Flex>
            }
            size="sm"
          />
        </Flex>
        <ButtonBarWrapper data-test-id="seer-button-bar">
          <ButtonBar>
            <Feature features={['organizations:autofix-seer-preferences']}>
              <LinkButton
                external
                href={`/settings/${organization.slug}/projects/${project.slug}/seer/`}
                size="xs"
                title={t('Project Settings for Seer')}
                aria-label={t('Project Settings for Seer')}
                icon={<IconSettings />}
              />
            </Feature>
            {aiConfig.hasAutofix && (
              <Button
                size="xs"
                onClick={() => {
                  reset();
                  aiConfig.refetchAutofixSetup?.();
                }}
                title={
                  autofixData?.last_triggered_at
                    ? tct('Last run at [date]', {
                        date: <DateTime date={lastTriggeredAt} />,
                      })
                    : null
                }
                disabled={!autofixData}
              >
                {t('Start Over')}
              </Button>
            )}
          </ButtonBar>
        </ButtonBarWrapper>
      </SeerDrawerNavigator>

      <SeerDrawerBody ref={scrollContainerRef} onScroll={handleScroll}>
        <SeerNotices
          groupId={group.id}
          hasGithubIntegration={aiConfig.hasGithubIntegration}
          project={project}
        />
        {aiConfig.hasSummary && (
          <StyledCard>
            <GroupSummary
              group={group}
              event={event}
              project={project}
              collapsed={!!autofixData}
            />
          </StyledCard>
        )}
        {aiConfig.hasAutofix && (
          <Fragment>
            {autofixData ? (
              <AutofixSteps
                data={autofixData}
                groupId={group.id}
                runId={autofixData.run_id}
                event={event}
              />
            ) : autofixDataPending ? (
              <PlaceholderStack>
                <Placeholder height="15rem" />
                <Placeholder height="15rem" />
              </PlaceholderStack>
            ) : (
              <AutofixStartBox onSend={triggerAutofix} groupId={group.id} />
            )}
          </Fragment>
        )}
      </SeerDrawerBody>
    </SeerDrawerContainer>
  );
}

export const useOpenSeerDrawer = ({
  group,
  project,
  event,
}: {
  event: Event | null;
  group: Group;
  project: Project;
  buttonRef?: React.RefObject<HTMLButtonElement | null>;
}) => {
  const {openDrawer} = useDrawer();
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();

  const openSeerDrawer = useCallback(() => {
    if (
      !event ||
      !organization.features.includes('gen-ai-features') ||
      organization.hideAiFeatures
    ) {
      return;
    }

    openDrawer(() => <SeerDrawer group={group} project={project} event={event} />, {
      ariaLabel: t('Seer drawer'),
      drawerKey: 'seer-autofix-drawer',
      drawerCss: css`
        height: fit-content;
        max-height: 100%;
      `,
      shouldCloseOnInteractOutside: () => {
        return false;
      },
      onClose: () => {
        navigate(
          {
            pathname: location.pathname,
            query: {
              ...location.query,
              seerDrawer: undefined,
            },
          },
          {replace: true, preventScrollReset: true}
        );
      },
    });
  }, [openDrawer, event, group, project, location, navigate, organization]);

  return {openSeerDrawer};
};

const PlaceholderStack = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  margin-top: ${space(2)};
`;

const StyledCard = styled('div')`
  background: ${p => p.theme.tokens.background.primary};
  overflow: visible;
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  padding: ${space(2)} ${space(2)};
  box-shadow: ${p => p.theme.dropShadowMedium};
  transition: all 0.3s ease-in-out;
`;

const SeerDrawerContainer = styled('div')`
  height: 100%;
  display: grid;
  grid-template-rows: auto auto auto 1fr;
  position: relative;
  background: ${p => p.theme.backgroundSecondary};
`;

const SeerDrawerHeader = styled(DrawerHeader)`
  position: unset;
  max-height: ${MIN_NAV_HEIGHT}px;
  box-shadow: none;
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
`;

const SeerDrawerNavigator = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(0.75)} ${space(3)};
  background: ${p => p.theme.tokens.background.primary};
  z-index: 1;
  min-height: ${MIN_NAV_HEIGHT}px;
  box-shadow: ${p => p.theme.tokens.border.transparent.neutral.muted} 0 1px;
`;

const SeerDrawerBody = styled(DrawerBody)`
  overflow: auto;
  overscroll-behavior: contain;
  scroll-behavior: smooth;
  /* Move the scrollbar to the left edge */
  scroll-margin: 0 ${space(2)};
  direction: rtl;
  * {
    direction: ltr;
  }
  padding-bottom: 80px;
`;

const Header = styled('h3')`
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: ${p => p.theme.fontWeight.bold};
  margin: 0;
`;

const NavigationCrumbs = styled(NavigationBreadcrumbs)`
  margin: 0;
  padding: 0;
`;

const ShortId = styled('div')`
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSize.md};
  line-height: 1;
`;

const ButtonBarWrapper = styled('div')`
  margin-left: auto;
`;

const FeedbackWrapper = styled('div')`
  margin-left: auto;
  margin-right: ${p => p.theme.space.md};
`;
