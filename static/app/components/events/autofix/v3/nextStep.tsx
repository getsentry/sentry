import {useCallback, type ReactNode} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  isCodeChangesSection,
  isRootCauseSection,
  isSolutionSection,
  type AutofixSection,
  type useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';

interface SeerDrawerNextStepProps {
  autofix: ReturnType<typeof useExplorerAutofix>;
  sections: AutofixSection[];
}

export function SeerDrawerNextStep({sections, autofix}: SeerDrawerNextStepProps) {
  const runId = autofix.runState?.run_id;
  const lastSection = sections[sections.length - 1];

  if (!defined(runId) || !defined(lastSection)) {
    return null;
  }

  if (isRootCauseSection(lastSection)) {
    return <RootCauseNextStep autofix={autofix} runId={runId} />;
  }

  if (isSolutionSection(lastSection)) {
    return <SolutionNextStep autofix={autofix} runId={runId} />;
  }

  if (isCodeChangesSection(lastSection)) {
    return <CodeChangesNextStep autofix={autofix} runId={runId} />;
  }

  return null;
}

interface NextStepProps {
  autofix: ReturnType<typeof useExplorerAutofix>;
  runId: number;
}

function RootCauseNextStep({autofix, runId}: NextStepProps) {
  const {startStep} = autofix;

  const handleYesClick = useCallback(() => {
    startStep('solution', runId);
  }, [startStep, runId]);

  const handleNoClick = useCallback(() => {
    // for now, just re run the current step
    startStep('root_cause', runId);
  }, [startStep, runId]);

  return (
    <NextStep
      prompt={t('Are you happy with this root cause?')}
      labelYes={t('Yes, make an implementation plan')}
      onClickYes={handleYesClick}
      labelNo={t('No')}
      onClickNo={handleNoClick}
    />
  );
}

function SolutionNextStep({autofix, runId}: NextStepProps) {
  const {startStep} = autofix;

  const handleYesClick = useCallback(() => {
    startStep('code_changes', runId);
  }, [startStep, runId]);

  const handleNoClick = useCallback(() => {
    // for now, just re run the current step
    startStep('solution', runId);
  }, [startStep, runId]);

  return (
    <NextStep
      prompt={t('Are you happy with this implementation plan?')}
      labelYes={t('Yes, write a code fix')}
      onClickYes={handleYesClick}
      labelNo={t('No')}
      onClickNo={handleNoClick}
    />
  );
}

function CodeChangesNextStep({autofix, runId}: NextStepProps) {
  const {createPR, startStep} = autofix;

  const handleYesClick = useCallback(() => {
    createPR(runId);
  }, [createPR, runId]);

  const handleNoClick = useCallback(() => {
    startStep('code_changes', runId);
  }, [startStep, runId]);

  return (
    <NextStep
      prompt={t('Are you happy with these code changes?')}
      labelYes={t('Yes, draft a PR')}
      onClickYes={handleYesClick}
      labelNo={t('No')}
      onClickNo={handleNoClick}
    />
  );
}

interface NextStepTemplateProps {
  labelNo: ReactNode;
  labelYes: ReactNode;
  onClickNo: () => void;
  onClickYes: () => void;
  prompt: ReactNode;
}

function NextStep({
  prompt,
  labelYes,
  onClickYes,
  labelNo,
  onClickNo,
}: NextStepTemplateProps) {
  return (
    <Flex direction="column" gap="lg">
      <Text>{prompt}</Text>
      <Flex gap="md">
        <Button onClick={onClickNo}>{labelNo}</Button>
        <Button priority="primary" onClick={onClickYes}>
          {labelYes}
        </Button>
      </Flex>
    </Flex>
  );
}
