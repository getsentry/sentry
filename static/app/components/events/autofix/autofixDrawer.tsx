import {useState} from 'react';
import styled from '@emotion/styled';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {Breadcrumbs as NavigationBreadcrumbs} from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import AutofixFeedback from 'sentry/components/events/autofix/autofixFeedback';
import AutofixMessageBox from 'sentry/components/events/autofix/autofixMessageBox';
import {AutofixSteps} from 'sentry/components/events/autofix/autofixSteps';
import {useAiAutofix} from 'sentry/components/events/autofix/useAutofix';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getShortEventId} from 'sentry/utils/events';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {MIN_NAV_HEIGHT} from 'sentry/views/issueDetails/streamline/eventNavigation';

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
          <AutofixMessageBox
            displayText={'Ready to begin analyzing the issue?'}
            step={null}
            inputPlaceholder={'Optionally provide any extra context before we start...'}
            responseRequired={false}
            onSend={triggerAutofix}
            actionText={'Start'}
            allowEmptyMessage
            isDisabled={false}
            runId={''}
            groupId={group.id}
          />
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
