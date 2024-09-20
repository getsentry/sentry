import {useState} from 'react';
import styled from '@emotion/styled';

import bannerImage from 'sentry-images/spot/ai-suggestion-banner.svg';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {Breadcrumbs as NavigationBreadcrumbs} from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import AutofixFeedback from 'sentry/components/events/autofix/autofixFeedback';
import {AutofixSteps} from 'sentry/components/events/autofix/autofixSteps';
import {useAiAutofix} from 'sentry/components/events/autofix/useAutofix';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import Input from 'sentry/components/input';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getShortEventId} from 'sentry/utils/events';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {MIN_NAV_HEIGHT} from 'sentry/views/issueDetails/streamline/eventNavigation';

interface AutofixStartBoxProps {
  onSend: (message: string) => void;
}

function AutofixStartBox({onSend}: AutofixStartBoxProps) {
  const [message, setMessage] = useState('');

  const send = () => {
    onSend(message);
  };

  return (
    <StartBox>
      <Header>Autofix is ready to start</Header>
      <br />
      <p>
        We'll begin by trying to figure out the root cause, analyzing the issue details
        and the codebase. If you have any other helpful context on the issue before we
        begin, you can share that below.
      </p>
      <Input
        type="text"
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder={'Provide any extra context here...'}
      />
      <br />
      <Button priority="primary" onClick={send}>
        Start
      </Button>
      <IllustrationContainer>
        <Illustration src={bannerImage} />
      </IllustrationContainer>
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

  const [_, setContainer] = useState<HTMLElement | null>(null);

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
      <AutofixDrawerBody ref={setContainer}>
        {!autofixData ? (
          <AutofixStartBox onSend={triggerAutofix} />
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

const IllustrationContainer = styled('div')`
  padding-top: ${space(4)};
`;

const Illustration = styled('img')`
  height: 100%;
`;

const StartBox = styled('div')`
  padding: ${space(2)};
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
  width: 100%;
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
