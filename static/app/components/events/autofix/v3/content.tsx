import {Fragment, useMemo} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {IconClose} from '@sentry/icons/close';
import {IconSeer} from '@sentry/icons/seer';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';

import {
  AutofixOutOfCreditsAlert,
  getAutofixContinueAction,
} from 'sentry/components/events/autofix/autofixCredits';
import {getAutofixRunId} from 'sentry/components/events/autofix/autofixRunId';
import {
  getOrderedAutofixSections,
  isCodeChangesSection,
  isCodingAgentsSection,
  isLastStepPrIteration,
  isPullRequestsSection,
  isRootCauseSection,
  isSingleRunAutofix,
  isSolutionSection,
  useExplorerAutofix,
  type AutofixSection,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {useAiConfig} from 'sentry/views/issueDetails/hooks/useAiConfig';

import {AutofixStartCard} from './autofixStartCard';
import {CodeChangesCard} from './codeChangesCard';
import {CodingAgentsCard} from './codingAgentsCard';
import {SeerDrawerNextStep} from './nextStep';
import {PullRequestsCard} from './pullRequestsCard';
import {RootCauseCard} from './rootCauseCard';
import {SeerEnableNotifications} from './seerEnableNotifications';
import {SolutionCard} from './solutionCard';
import {useIsSingleRunChatOpen, useOpenSingleRunChat} from './useToggleSingleRunChat';

interface SeerDrawerContentProps {
  aiConfig: ReturnType<typeof useAiConfig>;
  autofix: ReturnType<typeof useExplorerAutofix>;
  group: Group;
  /**
   * Pin the next step to the bottom of the viewport while any autofix content is
   * on screen. The drawer scrolls its own body and always ends on the next step,
   * so only the tab, which scrolls with the page, asks for this.
   */
  stickyNextStep?: boolean;
}

export function SeerDrawerContent({
  aiConfig,
  autofix,
  group,
  stickyNextStep,
}: SeerDrawerContentProps) {
  const sections = useMemo(
    () => getOrderedAutofixSections(autofix.runState),
    [autofix.runState]
  );
  const singleRun = isSingleRunAutofix(autofix.runState) ? autofix.runState : null;
  const singleRunId = getAutofixRunId(singleRun);
  const openSingleRunChat = useOpenSingleRunChat();
  const isSingleRunChatOpen = useIsSingleRunChatOpen(singleRunId);

  const isLoadingRun =
    autofix.isLoading || (autofix.isPolling && !autofix.runState?.blocks?.length);

  if (isLoadingRun && !autofix.isWaitingForRun) {
    return (
      <Stack gap="xl">
        <Placeholder height="15rem" />
      </Stack>
    );
  }

  // One out-of-credits alert, at the top so it sits above any results. The
  // triggers below it stay on screen, disabled.
  if (!autofix.runState && aiConfig.hasAutofix) {
    return (
      <Stack gap="lg">
        <AutofixOutOfCreditsAlert action="root_cause" reason="autofix-start" />
        <AutofixStartCard autofix={autofix} group={group} />
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <AutofixOutOfCreditsAlert
        action={getAutofixContinueAction({
          isPolling: autofix.isPolling,
          runState: autofix.runState,
          sections,
        })}
        reason="autofix-continue"
      />
      <SeerDrawerArtifacts autofix={autofix} sections={sections} groupId={group.id} />
      {!isSingleRunAutofix(autofix.runState) &&
        (autofix.runState?.status === 'completed' ||
          isLastStepPrIteration(autofix.runState)) && (
          <NextStepWrap isSticky={stickyNextStep}>
            <SeerDrawerNextStep group={group} autofix={autofix} sections={sections} />
          </NextStepWrap>
        )}
      {singleRun && (
        <NextStepWrap isSticky={stickyNextStep}>
          <Button
            variant="primary"
            icon={<IconSeer />}
            onClick={() => singleRunId !== undefined && openSingleRunChat(singleRunId)}
            disabled={isSingleRunChatOpen}
            tooltipProps={{title: isSingleRunChatOpen ? t('Chat is open') : undefined}}
          >
            {t('Open Autofix')}
          </Button>
        </NextStepWrap>
      )}
      {autofix.codingAgentErrors.map(({id, message}) => (
        <Alert
          key={id}
          variant="danger"
          trailingItems={
            <Button
              size="zero"
              variant="transparent"
              icon={<IconClose size="sm" />}
              aria-label={t('Dismiss error')}
              onClick={() => autofix.dismissCodingAgentError(id)}
            />
          }
        >
          {message}
        </Alert>
      ))}

      <SeerEnableNotifications status={autofix.runState?.status} />
    </Stack>
  );
}

interface SeerDrawerArtifactsProps {
  autofix: ReturnType<typeof useExplorerAutofix>;
  groupId: string;
  sections: AutofixSection[];
}

function SeerDrawerArtifacts({autofix, groupId, sections}: SeerDrawerArtifactsProps) {
  return (
    <Fragment>
      {sections.map(section => {
        const key = `${section.step}-${section.blocks[0]?.id ?? null}`;

        if (isRootCauseSection(section)) {
          return (
            <RootCauseCard
              key={key}
              autofix={autofix}
              section={section}
              groupId={groupId}
            />
          );
        }

        if (isSolutionSection(section)) {
          return <SolutionCard key={key} autofix={autofix} section={section} />;
        }

        if (isCodeChangesSection(section)) {
          return (
            <CodeChangesCard
              key={key}
              autofix={autofix}
              section={section}
              groupId={groupId}
            />
          );
        }

        if (isPullRequestsSection(section)) {
          return <PullRequestsCard key={key} autofix={autofix} section={section} />;
        }

        if (isCodingAgentsSection(section)) {
          return <CodingAgentsCard key={key} autofix={autofix} section={section} />;
        }

        // TODO: maybe send a log?
        return null;
      })}
    </Fragment>
  );
}

/**
 * Sticky bottom rather than a fixed bar: the next step stays on screen while the
 * analysis above it is still in view, then scrolls away with the rest of the
 * autofix content once the reader moves past it into the event details below.
 */
const NextStepWrap = styled('div', {
  shouldForwardProp: prop => prop !== 'isSticky',
})<{isSticky?: boolean}>`
  ${p =>
    p.isSticky &&
    css`
      position: sticky;
      bottom: 0;
      z-index: ${p.theme.zIndex.initial};
      background: ${p.theme.tokens.background.secondary};
      padding-block: ${p.theme.space.md};
    `}
`;
