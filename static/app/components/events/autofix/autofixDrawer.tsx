import {useState} from 'react';
import styled from '@emotion/styled';

import starImage from 'sentry-images/spot/banner-star.svg';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {Breadcrumbs as NavigationBreadcrumbs} from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import AutofixFeedback from 'sentry/components/events/autofix/autofixFeedback';
import {AutofixSteps} from 'sentry/components/events/autofix/autofixSteps';
import {useAiAutofix} from 'sentry/components/events/autofix/useAutofix';
import {useAutofixSetup} from 'sentry/components/events/autofix/useAutofixSetup';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import {GroupSummaryBody, useGroupSummary} from 'sentry/components/group/groupSummary';
import Input from 'sentry/components/input';
import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getShortEventId} from 'sentry/utils/events';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {MIN_NAV_HEIGHT} from 'sentry/views/issueDetails/streamline/eventTitle';

import {AutofixSetupContent} from './autofixSetupModal';

interface AutofixStartBoxProps {
  groupId: string;
  onSend: (message: string) => void;
}

function AutofixStartBox({onSend, groupId}: AutofixStartBoxProps) {
  const [message, setMessage] = useState('');

  const send = () => {
    onSend(message);
  };

  return (
    <StartBox>
      <StarTrail>
        {[...Array(8)].map((_, i) => (
          <TrailStar
            key={i}
            src={starImage}
            index={i}
            size={28 - i * 2}
            offset={(i % 2) * 30 - 15}
          />
        ))}
      </StarTrail>
      <ContentContainer>
        <Header>Autofix</Header>
        <br />
        <p>Work together with Autofix to find the root cause and fix the issue.</p>
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
              priority="primary"
              onClick={send}
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
              {message ? 'Start' : 'Start Autofix'}
            </Button>
          </ButtonWithStars>
        </Row>
      </ContentContainer>
    </StartBox>
  );
}

interface AutofixDrawerProps {
  event: Event;
  group: Group;
  project: Project;
}

export function AutofixDrawer({group, project, event}: AutofixDrawerProps) {
  const {autofixData, triggerAutofix, reset} = useAiAutofix(group, event);
  const {data: summaryData, isError} = useGroupSummary(group.id, group.issueCategory);
  const {
    data: setupData,
    isPending: isSetupLoading,
    refetch: refetchSetup,
  } = useAutofixSetup({
    groupId: group.id,
  });

  useRouteAnalyticsParams({
    autofix_status: autofixData?.status ?? 'none',
  });

  const isSetupComplete = setupData?.integration.ok && setupData?.genAIConsent.ok;

  return (
    <AutofixDrawerContainer>
      <AutofixDrawerHeader>
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
            {label: t('Autofix')},
          ]}
        />
      </AutofixDrawerHeader>
      <AutofixNavigator>
        <Header>{t('Autofix')}</Header>
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
      </AutofixNavigator>
      <AutofixDrawerBody>
        <HeaderText>
          <IconSeer size="lg" />
          {t('Sentry AI')}
        </HeaderText>
        <StyledCard>
          <GroupSummaryBody data={summaryData} isError={isError} />
        </StyledCard>
        {!isSetupLoading && !isSetupComplete ? (
          <SetupContainer>
            <AutofixSetupContent
              projectId={project.id}
              groupId={group.id}
              closeModal={() => {}}
              refetchSetup={refetchSetup}
            />
          </SetupContainer>
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
      </AutofixDrawerBody>
    </AutofixDrawerContainer>
  );
}

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

const AutofixDrawerContainer = styled('div')`
  height: 100%;
  display: grid;
  grid-template-rows: auto auto 1fr;
`;

const AutofixDrawerHeader = styled(DrawerHeader)`
  position: unset;
  max-height: ${MIN_NAV_HEIGHT}px;
  box-shadow: none;
  border-bottom: 1px solid ${p => p.theme.border};
`;

const AutofixNavigator = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  column-gap: ${space(1)};
  padding: ${space(0.75)} 24px;
  background: ${p => p.theme.background};
  z-index: 1;
  min-height: ${MIN_NAV_HEIGHT}px;
  box-shadow: ${p => p.theme.translucentBorder} 0 1px;
`;

const AutofixDrawerBody = styled(DrawerBody)`
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

const SetupContainer = styled('div')`
  padding: ${space(2)};

  /* Override some modal-specific styles */
  h3 {
    font-size: ${p => p.theme.fontSizeLarge};
    margin-bottom: ${space(2)};
  }
`;

const StyledCard = styled('div')`
  background: ${p => p.theme.backgroundElevated};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
  overflow: hidden;
  box-shadow: ${p => p.theme.dropShadowMedium};
  padding-bottom: ${space(1)};
`;

const HeaderText = styled('div')`
  font-weight: bold;
  font-size: ${p => p.theme.fontSizeLarge};
  display: flex;
  align-items: center;
  gap: ${space(1)};
  padding-bottom: ${space(2)};
`;

const StarTrail = styled('div')`
  height: 400px;
  width: 100%;
  display: flex;
  justify-content: center;
  position: absolute;
  bottom: 5rem;
  left: 0;
  right: 0;
  z-index: -1;
  pointer-events: none;
`;

const TrailStar = styled('img')<{index: number; offset: number; size: number}>`
  position: absolute;
  width: ${p => p.size}px;
  height: ${p => p.size}px;
  top: ${p => p.index * 50}px;
  transform: translateX(${p => p.offset}px) rotate(${p => p.index * 40}deg);
  opacity: ${p => Math.max(0.2, 1 - p.index * 0.1)};
  filter: sepia(1) saturate(3) hue-rotate(290deg);
`;
