import {Fragment, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import starImage from 'sentry-images/spot/banner-star.svg';

import {SeerIcon} from 'sentry/components/ai/SeerIcon';
import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import FeatureBadge from 'sentry/components/badge/featureBadge';
import {Breadcrumbs as NavigationBreadcrumbs} from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import AutofixFeedback from 'sentry/components/events/autofix/autofixFeedback';
import {AutofixSetupContent} from 'sentry/components/events/autofix/autofixSetupModal';
import {AutofixSteps} from 'sentry/components/events/autofix/autofixSteps';
import {useAiAutofix} from 'sentry/components/events/autofix/useAutofix';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import {GroupSummary} from 'sentry/components/group/groupSummary';
import HookOrDefault from 'sentry/components/hookOrDefault';
import Input from 'sentry/components/input';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconArrow, IconDocs} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getShortEventId} from 'sentry/utils/events';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {MIN_NAV_HEIGHT} from 'sentry/views/issueDetails/streamline/eventTitle';
import {useAiConfig} from 'sentry/views/issueDetails/streamline/hooks/useAiConfig';
import Resources from 'sentry/views/issueDetails/streamline/sidebar/resources';

interface AutofixStartBoxProps {
  groupId: string;
  onSend: (message: string) => void;
}

function AutofixStartBox({onSend, groupId}: AutofixStartBoxProps) {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSend(message);
  };

  return (
    <Wrapper>
      <ScaleContainer>
        <StyledArrow direction="down" size="sm" />
        <Container>
          <AutofixStartText>
            <BackgroundStar
              src={starImage}
              style={{
                width: '20px',
                height: '20px',
                right: '5%',
                top: '20%',
                transform: 'rotate(15deg)',
              }}
            />
            <BackgroundStar
              src={starImage}
              style={{
                width: '16px',
                height: '16px',
                right: '35%',
                top: '40%',
                transform: 'rotate(45deg)',
              }}
            />
            <BackgroundStar
              src={starImage}
              style={{
                width: '14px',
                height: '14px',
                right: '25%',
                top: '60%',
                transform: 'rotate(30deg)',
              }}
            />
            Need help digging deeper?
          </AutofixStartText>
          <InputWrapper onSubmit={handleSubmit}>
            <StyledInput
              type="text"
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="(Optional) Share helpful context here..."
            />
            <StyledButton
              type="submit"
              priority="primary"
              analyticsEventKey={
                message
                  ? 'autofix.give_instructions_clicked'
                  : 'autofix.start_fix_clicked'
              }
              analyticsEventName={
                message
                  ? 'Autofix: Give Instructions Clicked'
                  : 'Autofix: Start Fix Clicked'
              }
              analyticsParams={{group_id: groupId}}
            >
              {t('Start Autofix')}
            </StyledButton>
          </InputWrapper>
        </Container>
      </ScaleContainer>
    </Wrapper>
  );
}

interface SolutionsHubDrawerProps {
  event: Event;
  group: Group;
  project: Project;
}

const AiSetupDataConsent = HookOrDefault({
  hookName: 'component:ai-setup-data-consent',
  defaultComponent: () => <div data-test-id="ai-setup-data-consent" />,
});

export function SolutionsHubDrawer({group, project, event}: SolutionsHubDrawerProps) {
  const {autofixData, triggerAutofix, reset} = useAiAutofix(group, event);
  const aiConfig = useAiConfig(group, event, project);

  useRouteAnalyticsParams({
    autofix_status: autofixData?.status ?? 'none',
  });

  const config = getConfigForIssueType(group, project);

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

  useEffect(() => {
    // Only auto-scroll if user hasn't manually scrolled
    if (!userScrolledRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [autofixData]);

  return (
    <SolutionsDrawerContainer className="solutions-drawer-container">
      <SolutionsDrawerHeader>
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
            {label: t('Solutions Hub')},
          ]}
        />
      </SolutionsDrawerHeader>
      <SolutionsDrawerNavigator>
        <Header>{t('Solutions Hub')}</Header>
        {autofixData && (
          <ButtonBarWrapper>
            <ButtonBar gap={1}>
              <AutofixFeedback />
              <Button
                size="xs"
                onClick={reset}
                title={
                  autofixData.created_at
                    ? `Last run at ${autofixData.created_at.split('T')[0]}`
                    : null
                }
              >
                {t('Start Over')}
              </Button>
            </ButtonBar>
          </ButtonBarWrapper>
        )}
      </SolutionsDrawerNavigator>
      <SolutionsDrawerBody ref={scrollContainerRef} onScroll={handleScroll}>
        {config.resources && (
          <ResourcesContainer>
            <ResourcesHeader>
              <IconDocs size="md" />
              {t('Resources')}
            </ResourcesHeader>
            <ResourcesBody>
              <Resources
                eventPlatform={event?.platform}
                group={group}
                configResources={config.resources}
              />
            </ResourcesBody>
          </ResourcesContainer>
        )}
        <HeaderText>
          <HeaderContainer>
            <SeerIcon size="lg" />
            {t('Sentry AI')}
            <StyledFeatureBadge
              type="beta"
              title={tct(
                'This feature is in beta. Try it out and let us know your feedback at [email:autofix@sentry.io].',
                {
                  email: <a href="mailto:autofix@sentry.io" />,
                }
              )}
            />
          </HeaderContainer>
        </HeaderText>
        {aiConfig.isAutofixSetupLoading ? (
          <div data-test-id="ai-setup-loading-indicator">
            <LoadingIndicator />
          </div>
        ) : aiConfig.needsGenAIConsent ? (
          <AiSetupDataConsent groupId={group.id} />
        ) : (
          <Fragment>
            {aiConfig.hasSummary && (
              <StyledCard>
                <GroupSummary group={group} event={event} project={project} />
              </StyledCard>
            )}
            {aiConfig.hasAutofix && (
              <Fragment>
                {aiConfig.needsAutofixSetup ? (
                  <AutofixSetupContent groupId={group.id} projectId={project.id} />
                ) : !autofixData ? (
                  <AutofixStartBox onSend={triggerAutofix} groupId={group.id} />
                ) : (
                  <AutofixSteps
                    data={autofixData}
                    groupId={group.id}
                    runId={autofixData.run_id}
                    onRetry={reset}
                  />
                )}
              </Fragment>
            )}
          </Fragment>
        )}
      </SolutionsDrawerBody>
    </SolutionsDrawerContainer>
  );
}

const ResourcesContainer = styled('div')``;
const ResourcesBody = styled('div')`
  padding: 0 ${space(2)} ${space(2)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.border};
  margin-bottom: ${space(2)};
`;

const Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: ${space(1)} ${space(4)};
  gap: ${space(1)};
`;

const ScaleContainer = styled('div')`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${space(1)};
`;

const Container = styled('div')`
  position: relative;
  width: 100%;
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.theme.background}
    linear-gradient(135deg, ${p => p.theme.background}, ${p => p.theme.pink400}20);
  overflow: hidden;
  padding: ${space(0.5)};
`;

const AutofixStartText = styled('div')`
  margin: 0;
  padding: ${space(2)};
  padding-bottom: ${space(1)};
  white-space: pre-wrap;
  word-break: break-word;
  font-size: ${p => p.theme.fontSizeLarge};
  position: relative;
`;

const BackgroundStar = styled('img')`
  position: absolute;
  filter: sepia(1) saturate(3) hue-rotate(290deg);
  opacity: 0.7;
  pointer-events: none;
  z-index: 0;
`;

const StyledArrow = styled(IconArrow)`
  color: ${p => p.theme.subText};
  opacity: 0.5;
`;

const InputWrapper = styled('form')`
  display: flex;
  gap: ${space(0.5)};
  padding: ${space(0.25)} ${space(0.25)};
`;

const StyledInput = styled(Input)`
  flex-grow: 1;
  background: ${p => p.theme.background};
  border-color: ${p => p.theme.innerBorder};

  &:hover {
    border-color: ${p => p.theme.border};
  }
`;

const StyledButton = styled(Button)`
  flex-shrink: 0;
`;

const StyledCard = styled('div')`
  background: ${p => p.theme.backgroundElevated};
  overflow: hidden;
  border-bottom: 1px solid ${p => p.theme.border};
  padding: ${space(1.5)} ${space(2)};
`;

const HeaderText = styled('div')`
  font-weight: bold;
  font-size: ${p => p.theme.fontSizeLarge};
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  padding-bottom: ${space(2)};
  justify-content: space-between;
`;

const StyledFeatureBadge = styled(FeatureBadge)`
  margin-left: ${space(0.25)};
  padding-bottom: 3px;
`;

const ResourcesHeader = styled('div')`
  gap: ${space(1)};
  font-weight: bold;
  font-size: ${p => p.theme.fontSizeLarge};
  display: flex;
  align-items: center;
  padding-bottom: ${space(2)};
`;

const SolutionsDrawerContainer = styled('div')`
  height: 100%;
  display: grid;
  grid-template-rows: auto auto 1fr;
  position: relative;
`;

const SolutionsDrawerHeader = styled(DrawerHeader)`
  position: unset;
  max-height: ${MIN_NAV_HEIGHT}px;
  box-shadow: none;
  border-bottom: 1px solid ${p => p.theme.border};
`;

const SolutionsDrawerNavigator = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(0.75)} 24px;
  background: ${p => p.theme.background};
  z-index: 1;
  min-height: ${MIN_NAV_HEIGHT}px;
  box-shadow: ${p => p.theme.translucentBorder} 0 1px;
`;

const SolutionsDrawerBody = styled(DrawerBody)`
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
  display: block;
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

const HeaderContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const ButtonBarWrapper = styled('div')`
  margin-left: auto;
`;
