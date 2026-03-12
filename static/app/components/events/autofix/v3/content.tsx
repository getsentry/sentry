import {Fragment, useMemo} from 'react';

import {Flex} from '@sentry/scraps/layout';

import {
  getOrderedAutofixSections,
  isCodeChangesSection,
  isPullRequestSection,
  isRootCauseSection,
  isSolutionSection,
  useExplorerAutofix,
  type AutofixSection,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {
  CodeChangesCard,
  PullRequestsCard,
  RootCauseCard,
  SolutionCard,
} from 'sentry/components/events/autofix/v3/autofixCards';
import {SeerDrawerNextStep} from 'sentry/components/events/autofix/v3/nextStep';
import Placeholder from 'sentry/components/placeholder';
import type {useAiConfig} from 'sentry/views/issueDetails/streamline/hooks/useAiConfig';

interface SeerDrawerContentProps {
  aiConfig: ReturnType<typeof useAiConfig>;
  autofix: ReturnType<typeof useExplorerAutofix>;
}

export function SeerDrawerContent({aiConfig, autofix}: SeerDrawerContentProps) {
  const sections = useMemo(
    () => getOrderedAutofixSections(autofix.runState),
    [autofix.runState]
  );

  if (autofix.isLoading) {
    return (
      <Flex direction="column" gap="xl">
        <Placeholder height="10rem" />
        <Placeholder height="15rem" />
      </Flex>
    );
  }

  if (!autofix.runState && aiConfig.hasAutofix) {
    return null; // TODO: should this have an empty state?
  }

  return (
    <Flex direction="column" gap="lg">
      <SeerDrawerArtifacts sections={sections} />
      {autofix.runState?.status === 'completed' && (
        <SeerDrawerNextStep autofix={autofix} sections={sections} />
      )}
    </Flex>
  );
}

interface SeerDrawerArtifactsProps {
  sections: AutofixSection[];
}

function SeerDrawerArtifacts({sections}: SeerDrawerArtifactsProps) {
  return (
    <Fragment>
      {sections.map(section => {
        if (isRootCauseSection(section)) {
          return <RootCauseCard key={section.step} section={section} />;
        }

        if (isSolutionSection(section)) {
          return <SolutionCard key={section.step} section={section} />;
        }

        if (isCodeChangesSection(section)) {
          return <CodeChangesCard key={section.step} section={section} />;
        }

        if (isPullRequestSection(section)) {
          return <PullRequestsCard key={section.step} section={section} />;
        }

        // TODO: maybe send a log?
        return null;
      })}
    </Fragment>
  );
}
