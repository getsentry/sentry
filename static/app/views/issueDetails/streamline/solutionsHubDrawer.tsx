import {Fragment, useState} from 'react';
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
import {GroupSummary, useGroupSummary} from 'sentry/components/group/groupSummary';
import HookOrDefault from 'sentry/components/hookOrDefault';
import Input from 'sentry/components/input';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconDocs} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getShortEventId} from 'sentry/utils/events';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {MIN_NAV_HEIGHT} from 'sentry/views/issueDetails/streamline/eventTitle';
import Resources from 'sentry/views/issueDetails/streamline/resources';
import {useAiConfig} from 'sentry/views/issueDetails/streamline/useAiConfig';

interface AutofixStartBoxProps {
  groupId: string;
  onSend: (message: string) => void;
}

function AutofixStartBox({onSend, groupId}: AutofixStartBoxProps) {
  const [message, setMessage] = useState('');

  const stars = [
    {size: 10, left: 20, top: 5, rotation: 30, opacity: 0.15},
    {size: 12, left: 50, top: 8, rotation: 45, opacity: 0.2},
    {size: 10, left: 80, top: 12, rotation: 15, opacity: 0.2},
    {size: 14, left: 15, top: 20, rotation: 60, opacity: 0.3},
    {size: 16, left: 45, top: 25, rotation: 30, opacity: 0.35},
    {size: 14, left: 75, top: 22, rotation: 45, opacity: 0.3},
    {size: 18, left: 25, top: 35, rotation: 20, opacity: 0.4},
    {size: 20, left: 60, top: 38, rotation: 50, opacity: 0.45},
    {size: 18, left: 85, top: 42, rotation: 35, opacity: 0.4},
    {size: 22, left: 15, top: 55, rotation: 25, opacity: 0.5},
    {size: 24, left: 40, top: 58, rotation: 40, opacity: 0.55},
    {size: 22, left: 70, top: 52, rotation: 30, opacity: 0.5},
    {size: 26, left: 30, top: 70, rotation: 35, opacity: 0.65},
    {size: 28, left: 50, top: 75, rotation: 45, opacity: 0.7},
    {size: 26, left: 80, top: 72, rotation: 25, opacity: 0.7},
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSend(message);
  };

  return (
    <StartBox>
      <StarTrail>
        {stars.map((star, i) => (
          <TrailStar
            key={i}
            src={starImage}
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: star.opacity,
              transform: `rotate(${star.rotation}deg)`,
            }}
          />
        ))}
      </StarTrail>
      <ContentContainer>
        <HeaderText>Autofix</HeaderText>
        <p>Work together with Autofix to find the root cause and fix the issue.</p>
        <form onSubmit={handleSubmit}>
          <Row>
            <Input
              type="text"
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={'(Optional) Share helpful context here...'}
            />
            <ButtonWithStars>
              <StarLarge1 src={starImage} />
              <StarLarge2 src={starImage} />
              <StarLarge3 src={starImage} />
              <Button
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
                aria-label="Start Autofix"
              >
                {t('Start Autofix')}
              </Button>
            </ButtonWithStars>
          </Row>
        </form>
      </ContentContainer>
    </StartBox>
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
  const {
    data: summaryData,
    isError,
    isPending: isSummaryLoading,
  } = useGroupSummary(group, event, project);
  const aiConfig = useAiConfig(group, event, project);

  useRouteAnalyticsParams({
    autofix_status: autofixData?.status ?? 'none',
  });

  const config = getConfigForIssueType(group, project);

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
      </SolutionsDrawerNavigator>
      <SolutionsDrawerBody>
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
          {autofixData && (
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
          )}
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
                <GroupSummary
                  data={summaryData}
                  isError={isError}
                  isPending={isSummaryLoading}
                />
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

const Row = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

const StartBox = styled('div')`
  padding: ${space(2)};
  position: absolute;
  bottom: ${space(2)};
  left: ${space(2)};
  right: ${space(2)};
`;

const ContentContainer = styled('div')`
  position: relative;
  z-index: 1;
  margin-top: 80px;
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
  display: grid;
  grid-template-columns: 1fr;
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

const ButtonWithStars = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
`;

const StarLarge = styled('img')`
  position: absolute;
  z-index: 0;
  filter: sepia(1) saturate(3) hue-rotate(290deg);
`;

const StarLarge1 = styled(StarLarge)`
  left: 45px;
  bottom: -15px;
  transform: rotate(90deg);

  width: 16px;
  height: 16px;
`;

const StarLarge2 = styled(StarLarge)`
  left: -5px;
  top: -15px;
  transform: rotate(-30deg);
  width: 24px;
  height: 24px;
`;

const StarLarge3 = styled(StarLarge)`
  right: -25px;
  bottom: 0px;
  transform: rotate(20deg);
  width: 28px;
  height: 28px;
`;

const StyledCard = styled('div')`
  background: ${p => p.theme.backgroundElevated};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
  overflow: hidden;
  box-shadow: ${p => p.theme.dropShadowMedium};
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

const StarTrail = styled('div')`
  height: 450px;
  width: 100%;
  position: absolute;
  bottom: 5rem;
  left: 0;
  right: 0;
  z-index: -1;
  pointer-events: none;
  overflow: hidden;
`;

const TrailStar = styled('img')`
  position: absolute;
  filter: sepia(1) saturate(3) hue-rotate(290deg);
  transition: all 0.2s ease-in-out;
`;

const HeaderContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;
