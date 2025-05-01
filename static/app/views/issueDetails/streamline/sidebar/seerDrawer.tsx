import {Fragment, useCallback, useEffect, useRef} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import {Breadcrumbs as NavigationBreadcrumbs} from 'sentry/components/breadcrumbs';
import {Flex} from 'sentry/components/container/flex';
import {ProjectAvatar} from 'sentry/components/core/avatar/projectAvatar';
import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {Button, LinkButton} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {DateTime} from 'sentry/components/dateTime';
import AutofixFeedback from 'sentry/components/events/autofix/autofixFeedback';
import {AutofixProgressBar} from 'sentry/components/events/autofix/autofixProgressBar';
import {AutofixStartBox} from 'sentry/components/events/autofix/autofixStartBox';
import {AutofixSteps} from 'sentry/components/events/autofix/autofixSteps';
import {AutofixStepType} from 'sentry/components/events/autofix/types';
import {useAiAutofix} from 'sentry/components/events/autofix/useAutofix';
import useDrawer from 'sentry/components/globalDrawer';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import {GroupSummary} from 'sentry/components/group/groupSummary';
import HookOrDefault from 'sentry/components/hookOrDefault';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
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
import {MIN_NAV_HEIGHT} from 'sentry/views/issueDetails/streamline/eventTitle';
import {useAiConfig} from 'sentry/views/issueDetails/streamline/hooks/useAiConfig';
import {SeerNotices} from 'sentry/views/issueDetails/streamline/sidebar/seerNotices';

interface SeerDrawerProps {
  event: Event;
  group: Group;
  project: Project;
}

const AiSetupDataConsent = HookOrDefault({
  hookName: 'component:ai-setup-data-consent',
  defaultComponent: () => <div data-test-id="ai-setup-data-consent" />,
});

export function SeerDrawer({group, project, event}: SeerDrawerProps) {
  const organization = useOrganization();
  const {autofixData, triggerAutofix, reset} = useAiAutofix(group, event);
  const aiConfig = useAiConfig(group, project);
  const location = useLocation();
  const navigate = useNavigate();

  useRouteAnalyticsParams({autofix_status: autofixData?.status ?? 'none'});

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);
  const lastScrollTopRef = useRef(0);

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
      if (!scrollContainerRef.current || !autofixData) {
        return;
      }

      const findStepByType = (type: string) => {
        if (!autofixData?.steps?.length) {
          return null;
        }
        const step = autofixData.steps.find(s => {
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
            // This allows automatic scrolling to continue working for future updates
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
      }
    },
    [autofixData, location, navigate]
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
  }, [location.query.scrollTo, scrollToSection, autofixData]);

  return (
    <SeerDrawerContainer className="seer-drawer-container">
      <SeerDrawerHeader>
        <NavigationCrumbs
          crumbs={[
            {
              label: (
                <CrumbContainer>
                  <ProjectAvatar project={project} />
                  <ShortId>{group.shortId}</ShortId>
                </CrumbContainer>
              ),
            },
            {label: getShortEventId(event.id)},
            {label: t('Seer')},
          ]}
        />
      </SeerDrawerHeader>
      <SeerDrawerNavigator>
        <Flex align="center" gap={space(1)}>
          <Header>{t('Autofix')}</Header>
          <FeatureBadge
            type="beta"
            tooltipProps={{
              title: tct(
                'This feature is in beta. Try it out and let us know your feedback at [email:autofix@sentry.io].',
                {email: <a href="mailto:autofix@sentry.io" />}
              ),
              isHoverable: true,
            }}
          />
          <QuestionTooltip
            isHoverable
            title={
              <Flex column gap={space(1)}>
                <div>
                  {tct(
                    'Seer models are powered by generative Al. Per our [dataDocs:data usage policies], Sentry does not use your data to train Seer models or share your data with other customers without your express consent.',
                    {
                      dataDocs: (
                        <ExternalLink href="https://docs.sentry.io/product/issues/issue-details/sentry-ai/#data-processing" />
                      ),
                    }
                  )}
                </div>
                <div>
                  {tct('Seer can be turned off in [settingsDocs:Settings].', {
                    settingsDocs: (
                      <Link
                        to={`/settings/${organization.slug}/general-settings/#hideAiFeatures`}
                      />
                    ),
                  })}
                </div>
              </Flex>
            }
            size="sm"
          />
        </Flex>
        {!aiConfig.needsGenAiAcknowledgement && (
          <ButtonBarWrapper data-test-id="autofix-button-bar">
            <ButtonBar gap={1}>
              <Feature features={['organizations:autofix-seer-preferences']}>
                <LinkButton
                  to={`/settings/${organization.slug}/projects/${project.slug}/seer/`}
                  size="xs"
                  title={t('Project Settings for Autofix')}
                  aria-label={t('Project Settings for Autofix')}
                  icon={<IconSettings />}
                />
              </Feature>
              <AutofixFeedback />
              {aiConfig.hasAutofix && (
                <Button
                  size="xs"
                  onClick={reset}
                  title={
                    autofixData?.last_triggered_at
                      ? tct('Last run at [date]', {
                          date: <DateTime date={autofixData.last_triggered_at} />,
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
        )}
      </SeerDrawerNavigator>

      {!aiConfig.isAutofixSetupLoading &&
        !aiConfig.needsGenAiAcknowledgement &&
        autofixData && <AutofixProgressBar autofixData={autofixData} />}
      <SeerDrawerBody ref={scrollContainerRef} onScroll={handleScroll}>
        {aiConfig.isAutofixSetupLoading ? (
          <div data-test-id="ai-setup-loading-indicator">
            <LoadingIndicator />
          </div>
        ) : aiConfig.needsGenAiAcknowledgement ? (
          <AiSetupDataConsent groupId={group.id} />
        ) : (
          <Fragment>
            <SeerNotices
              groupId={group.id}
              hasGithubIntegration={aiConfig.hasGithubIntegration}
              project={project}
            />
            {aiConfig.hasSummary && (
              <StyledCard>
                <GroupSummary group={group} event={event} project={project} />
              </StyledCard>
            )}
            {aiConfig.hasAutofix && (
              <Fragment>
                {autofixData ? (
                  <AutofixSteps
                    data={autofixData}
                    groupId={group.id}
                    runId={autofixData.run_id}
                  />
                ) : (
                  <AutofixStartBox onSend={triggerAutofix} groupId={group.id} />
                )}
              </Fragment>
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
  buttonRef,
}: {
  event: Event | null;
  group: Group;
  project: Project;
  buttonRef?: React.RefObject<HTMLButtonElement | null>;
}) => {
  const {openDrawer} = useDrawer();
  const navigate = useNavigate();
  const location = useLocation();

  const openSeerDrawer = useCallback(() => {
    if (!event) {
      return;
    }

    openDrawer(() => <SeerDrawer group={group} project={project} event={event} />, {
      ariaLabel: t('Seer drawer'),
      drawerKey: 'seer-autofix-drawer',
      drawerCss: css`
        height: fit-content;
        max-height: 100%;
      `,
      shouldCloseOnInteractOutside: element => {
        const viewAllButton = buttonRef?.current;

        // Check if the element is inside any autofix input element
        const isInsideAutofixInput = () => {
          const rethinkInputs = document.querySelectorAll(
            '[data-autofix-input-type="rethink"]'
          );
          const agentCommentInputs = document.querySelectorAll(
            '[data-autofix-input-type="agent-comment"]'
          );

          // Check if element is inside any rethink input
          for (const input of rethinkInputs) {
            if (input.contains(element)) {
              return true;
            }
          }

          // Check if element is inside any agent comment input
          for (const input of agentCommentInputs) {
            if (input.contains(element)) {
              return true;
            }
          }

          return false;
        };

        if (
          viewAllButton?.contains(element) ||
          document.getElementById('sentry-feedback')?.contains(element) ||
          isInsideAutofixInput() ||
          document.getElementById('autofix-output-stream')?.contains(element) ||
          document.getElementById('autofix-write-access-modal')?.contains(element) ||
          element.closest('[data-overlay="true"]')
        ) {
          return false;
        }
        return true;
      },
      onClose: () => {
        navigate({
          pathname: location.pathname,
          query: {
            ...location.query,
            seerDrawer: undefined,
          },
        });
      },
    });
  }, [openDrawer, buttonRef, event, group, project, location, navigate]);

  return {openSeerDrawer};
};

const StyledCard = styled('div')`
  background: ${p => p.theme.backgroundElevated};
  overflow: visible;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(2)} ${space(3)};
  box-shadow: ${p => p.theme.dropShadowMedium};
`;

const SeerDrawerContainer = styled('div')`
  height: 100%;
  display: grid;
  grid-template-rows: auto auto auto 1fr;
  position: relative;
`;

const SeerDrawerHeader = styled(DrawerHeader)`
  position: unset;
  max-height: ${MIN_NAV_HEIGHT}px;
  box-shadow: none;
  border-bottom: 1px solid ${p => p.theme.border};
`;

const SeerDrawerNavigator = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(0.75)} ${space(3)};
  background: ${p => p.theme.background};
  z-index: 1;
  min-height: ${MIN_NAV_HEIGHT}px;
  box-shadow: ${p => p.theme.translucentBorder} 0 1px;
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
`;

const Header = styled('h3')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: ${p => p.theme.fontWeightBold};
  margin: 0;
`;

const NavigationCrumbs = styled(NavigationBreadcrumbs)`
  margin: 0;
  padding: 0;
`;

const CrumbContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

const ShortId = styled('div')`
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSizeMedium};
  line-height: 1;
`;

const ButtonBarWrapper = styled('div')`
  margin-left: auto;
`;
