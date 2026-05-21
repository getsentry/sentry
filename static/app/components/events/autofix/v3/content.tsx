import {Fragment, useMemo} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {
  getOrderedAutofixSections,
  isCodeChangesSection,
  isCodingAgentsSection,
  isPullRequestsSection,
  isRootCauseSection,
  isSolutionSection,
  useExplorerAutofix,
  type AutofixSection,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {CodeChangesCard} from 'sentry/components/events/autofix/v3/codeChangesCard';
import {CodingAgentsCard} from 'sentry/components/events/autofix/v3/codingAgentsCard';
import {SeerDrawerNextStep} from 'sentry/components/events/autofix/v3/nextStep';
import {PullRequestsCard} from 'sentry/components/events/autofix/v3/pullRequestsCard';
import {RootCauseCard} from 'sentry/components/events/autofix/v3/rootCauseCard';
import {SolutionCard} from 'sentry/components/events/autofix/v3/solutionCard';
import {Placeholder} from 'sentry/components/placeholder';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {useAiConfig} from 'sentry/views/issueDetails/streamline/hooks/useAiConfig';

interface SeerDrawerContentProps {
  aiConfig: ReturnType<typeof useAiConfig>;
  autofix: ReturnType<typeof useExplorerAutofix>;
  group: Group;
}

export function SeerDrawerContent({aiConfig, autofix, group}: SeerDrawerContentProps) {
  const sections = useMemo(
    () => getOrderedAutofixSections(autofix.runState),
    [autofix.runState]
  );

  if (
    // autofix results are loading
    autofix.isLoading ||
    // we're polling and no blocks have been added yet
    (autofix.isPolling && !autofix.runState?.blocks?.length)
  ) {
    return (
      <Flex direction="column" gap="xl">
        <Placeholder height="15rem" />
      </Flex>
    );
  }

  if (!autofix.runState && aiConfig.hasAutofix) {
    return null; // TODO: should this have an empty state?
  }

  return (
    <Flex direction="column" gap="lg">
      <SeerDrawerArtifacts autofix={autofix} sections={sections} groupId={group.id} />
      {autofix.runState?.status === 'completed' && (
        <SeerDrawerNextStep group={group} autofix={autofix} sections={sections} />
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
    </Flex>
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
          return <CodeChangesCard key={key} autofix={autofix} section={section} />;
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
