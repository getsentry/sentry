import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import bannerImage from 'sentry-images/insights/module-upsells/insights-module-upsell.svg';
import starImage from 'sentry-images/spot/banner-star.svg';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import FeatureBadge from 'sentry/components/badge/featureBadge';
import {Breadcrumbs as NavigationBreadcrumbs} from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import AutofixFeedback from 'sentry/components/events/autofix/autofixFeedback';
import {AutofixSetupContent} from 'sentry/components/events/autofix/autofixSetupContent';
import {AutofixSteps} from 'sentry/components/events/autofix/autofixSteps';
import {AutofixGroupSummary} from 'sentry/components/events/autofix/groupSummary';
import {useAiAutofix} from 'sentry/components/events/autofix/useAutofix';
import {useAutofixSetup} from 'sentry/components/events/autofix/useAutofixSetup';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import Input from 'sentry/components/input';
import {IconSeer} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {EntryType, type Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {MIN_NAV_HEIGHT} from 'sentry/views/issueDetails/streamline/eventTitle';

interface AutofixStartBoxProps {
  event: Event;
  groupId: string;
  onSend: (message: string) => void;
}

function hasStacktraceWithFrames(event: Event) {
  for (const entry of event.entries) {
    if (entry.type === EntryType.EXCEPTION) {
      if (entry.data.values?.some(value => value.stacktrace?.frames?.length)) {
        return true;
      }
    }

    if (entry.type === EntryType.THREADS) {
      if (entry.data.values?.some(thread => thread.stacktrace?.frames?.length)) {
        return true;
      }
    }
  }

  return false;
}

function AutofixStartBox({onSend, groupId, event}: AutofixStartBoxProps) {
  const [message, setMessage] = useState('');
  const hasStacktrace = hasStacktraceWithFrames(event);

  const send = () => {
    onSend(message);
  };

  return (
    <StartBox>
      <IllustrationContainer>
        <Illustration src={bannerImage} />
      </IllustrationContainer>
      <div>
        <Row>
          <MessageBoxHeader>Autofix</MessageBoxHeader>
          <FeatureBadge
            type="beta"
            title={tct(
              'Autofix is in beta. Try it out and let us know your feedback at [email:autofix@sentry.io].',
              {
                email: <a href="mailto:autofix@sentry.io" />,
              }
            )}
            tooltipProps={{isHoverable: true}}
          />
        </Row>
        <br />
        {!hasStacktrace && (
          <p>Sorry, Autofix can't help with issues without a stack trace.</p>
        )}
        {hasStacktrace && (
          <Fragment>
            <p>Work together with Autofix to find the root cause and fix the issue.</p>
            <Row>
              <TopRightStar src={starImage} alt="" />
              <BottomLeftStar src={starImage} alt="" />
              <BottomRightStar src={starImage} alt="" />
              <Input
                type="text"
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder={'(Optional) Give more context...'}
              />
              {message ? (
                <Button
                  priority="primary"
                  onClick={send}
                  analyticsEventKey="autofix.give_instructions_clicked"
                  analyticsEventName="Autofix: Give Instructions Clicked"
                  analyticsParams={{group_id: groupId}}
                >
                  Start Autofix
                </Button>
              ) : (
                <Button
                  priority="primary"
                  onClick={send}
                  analyticsEventKey="autofix.start_fix_clicked"
                  analyticsEventName="Autofix: Start Fix Clicked"
                  analyticsParams={{group_id: groupId}}
                >
                  Start Autofix
                </Button>
              )}
            </Row>
          </Fragment>
        )}
      </div>
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
  useRouteAnalyticsParams({
    autofix_status: autofixData?.status ?? 'none',
  });

  const {
    canStartAutofix,
    refetch: refetchAutofixSetup,
    isPending,
  } = useAutofixSetup({
    groupId: group.id,
  });

  const handleSetupComplete = () => {
    refetchAutofixSetup();
  };

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
            {label: t('Sentry AI')},
          ]}
        />
      </AutofixDrawerHeader>
      <AutofixNavigator>
        <HeaderContainer>
          <IconSeer size="lg" />
          <Header>{t('Sentry AI')}</Header>
        </HeaderContainer>
        <ButtonBar gap={1}>
          <AutofixFeedback />
          {autofixData && (
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
          )}
        </ButtonBar>
      </AutofixNavigator>
      <AutofixDrawerBody>
        <Fragment>
          <AutofixGroupSummary group={group} />
          {!canStartAutofix && !isPending && (
            <Fragment>
              <AutofixSetupContent
                groupId={group.id}
                projectId={project.id}
                onSetupComplete={handleSetupComplete}
              />
            </Fragment>
          )}
          {!autofixData && canStartAutofix && (
            <AutofixStartBox onSend={triggerAutofix} groupId={group.id} event={event} />
          )}
          {autofixData && canStartAutofix && (
            <AutofixSteps
              data={autofixData}
              group={group}
              runId={autofixData.run_id}
              onRetry={reset}
            />
          )}
        </Fragment>
      </AutofixDrawerBody>
    </AutofixDrawerContainer>
  );
}

const Row = styled('div')`
  display: flex;
  gap: ${space(1)};
  position: relative;
`;

const StarImage = styled('img')`
  position: absolute;
  width: 24px;
  height: 24px;
  pointer-events: none;
`;

const TopRightStar = styled(StarImage)`
  top: -20px;
  right: -15px;
  transform: rotate(15deg);
`;

const BottomLeftStar = styled(StarImage)`
  top: -10px;
  right: 100px;
  transform: rotate(-20deg);
  z-index: 1;
`;

const BottomRightStar = styled(StarImage)`
  bottom: -10px;
  right: -10px;
  transform: rotate(45deg);
`;

const IllustrationContainer = styled('div')`
  padding: ${space(4)} 0 ${space(4)} 0;
  display: flex;
  justify-content: center;
  flex: 1;
  min-height: 0;

  /* Ensure illustration doesn't overflow */
  img {
    max-height: 100%;
    object-fit: contain;
  }
`;

const Illustration = styled('img')``;

const StartBox = styled('div')`
  padding: ${space(2)} 0 0;
  display: flex;
  flex-direction: column;
  width: 100%;
  position: relative;
  flex: 1;
  min-height: 0;
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

  /* Add display: flex to allow StartBox to expand */
  display: flex;
  flex-direction: column;
`;

const Header = styled('h3')`
  display: block;
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: ${p => p.theme.fontWeightBold};
  margin: 0;
`;

const MessageBoxHeader = styled('p')`
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: ${p => p.theme.fontWeightBold};
  margin: 0;
  padding: 0;
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
  gap: ${space(1)};
`;
