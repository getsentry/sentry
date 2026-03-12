import {Fragment, useMemo} from 'react';

import {Flex} from '@sentry/scraps/layout';

import {
  getOrderedAutofixArtifacts,
  isRootCauseArtifact,
  isSolutionArtifact,
  useExplorerAutofix,
  type AutofixArtifact,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {
  CodeChangesCard,
  PullRequestsCard,
  RootCauseCard,
  SolutionCard,
} from 'sentry/components/events/autofix/v3/autofixCards';
import {SeerDrawerNextStep} from 'sentry/components/events/autofix/v3/nextStep';
import Placeholder from 'sentry/components/placeholder';
import {isArrayOf} from 'sentry/types/utils';
import type {useAiConfig} from 'sentry/views/issueDetails/streamline/hooks/useAiConfig';
import {isExplorerFilePatch, isRepoPRState} from 'sentry/views/seerExplorer/types';

interface SeerDrawerContentProps {
  aiConfig: ReturnType<typeof useAiConfig>;
  autofix: ReturnType<typeof useExplorerAutofix>;
}

export function SeerDrawerContent({aiConfig, autofix}: SeerDrawerContentProps) {
  const artifacts = useMemo(
    () => getOrderedAutofixArtifacts(autofix.runState),
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
      <SeerDrawerArtifacts artifacts={artifacts} />
      {autofix.runState?.status === 'completed' && (
        <SeerDrawerNextStep autofix={autofix} artifacts={artifacts} />
      )}
    </Flex>
  );
}

interface SeerDrawerArtifactsProps {
  artifacts: AutofixArtifact[];
}

function SeerDrawerArtifacts({artifacts}: SeerDrawerArtifactsProps) {
  return (
    <Fragment>
      {artifacts.map(artifact => {
        // there should only be 1 artifact of each type
        if (isRootCauseArtifact(artifact)) {
          return <RootCauseCard key="root-cause" artifact={artifact} />;
        }

        if (isSolutionArtifact(artifact)) {
          return <SolutionCard key="solution" artifact={artifact} />;
        }

        if (isArrayOf(artifact, isExplorerFilePatch) && artifact.length) {
          return <CodeChangesCard key="code-changes" artifact={artifact} />;
        }

        if (isArrayOf(artifact, isRepoPRState) && artifact.length) {
          return <PullRequestsCard key="pull-requests" artifact={artifact} />;
        }

        // TODO: maybe send a log?
        return null;
      })}
    </Fragment>
  );
}
