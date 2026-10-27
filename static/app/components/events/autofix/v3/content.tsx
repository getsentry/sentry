import {Fragment, useMemo} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {IconClose} from '@sentry/icons/close';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';

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
import {AutofixStartCard} from 'sentry/components/events/autofix/v3/autofixStartCard';
import {CodeChangesCard} from 'sentry/components/events/autofix/v3/codeChangesCard';
import {CodingAgentsCard} from 'sentry/components/events/autofix/v3/codingAgentsCard';
import {SeerDrawerNextStep} from 'sentry/components/events/autofix/v3/nextStep';
import {PullRequestsCard} from 'sentry/components/events/autofix/v3/pullRequestsCard';
import {RootCauseCard} from 'sentry/components/events/autofix/v3/rootCauseCard';
import {SeerEnableNotifications} from 'sentry/components/events/autofix/v3/seerEnableNotifications';
import {SingleRunChat} from 'sentry/components/events/autofix/v3/singleRunChat';
import {SolutionCard} from 'sentry/components/events/autofix/v3/solutionCard';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {useAiConfig} from 'sentry/views/issueDetails/hooks/useAiConfig';

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

  const isLoadingRun =
    autofix.isLoading || (autofix.isPolling && !autofix.runState?.blocks?.length);

  if (isLoadingRun && !autofix.isWaitingForRun) {
    return (
      <Stack gap="xl">
        <Placeholder height="15rem" />
      </Stack>
    );
  }

  if (!autofix.runState && aiConfig.hasAutofix) {
    return <AutofixStartCard autofix={autofix} group={group} />;
  }

  if (isSingleRunAutofix(autofix.runState)) {
    return <SingleRunChat autofix={autofix} />;
  }

  return (
    <Stack gap="lg">
      <SeerDrawerArtifacts autofix={autofix} sections={sections} groupId={group.id} />
      {(autofix.runState?.status === 'completed' ||
        isLastStepPrIteration(autofix.runState)) && (
        <NextStepWrap isSticky={stickyNextStep}>
          <SeerDrawerNextStep group={group} autofix={autofix} sections={sections} />
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
