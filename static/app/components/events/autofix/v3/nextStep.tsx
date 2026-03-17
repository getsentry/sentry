import {useCallback, useMemo, useState, type ReactNode} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {TextArea} from '@sentry/scraps/textarea';

import {
  isCodeChangesArtifact,
  isCodeChangesSection,
  isRootCauseArtifact,
  isRootCauseSection,
  isSolutionArtifact,
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
  const section = sections[sections.length - 1];

  if (!defined(runId) || !defined(section)) {
    return null;
  }

  if (isRootCauseSection(section)) {
    return <RootCauseNextStep autofix={autofix} runId={runId} section={section} />;
  }

  if (isSolutionSection(section)) {
    return <SolutionNextStep autofix={autofix} runId={runId} section={section} />;
  }

  if (isCodeChangesSection(section)) {
    return <CodeChangesNextStep autofix={autofix} runId={runId} section={section} />;
  }

  return null;
}

interface NextStepProps {
  autofix: ReturnType<typeof useExplorerAutofix>;
  runId: number;
  section: AutofixSection;
}

function RootCauseNextStep({autofix, runId, section}: NextStepProps) {
  const {startStep} = autofix;

  const handleYesClick = useCallback(() => {
    startStep('solution', runId);
  }, [startStep, runId]);

  const handleNoClick = useCallback(
    (userContext: string) => {
      startStep('root_cause', runId, userContext);
    },
    [startStep, runId]
  );

  const artifact = useMemo(
    () => section.artifacts.findLast(isRootCauseArtifact),
    [section.artifacts]
  );

  if (!defined(artifact)) {
    return null;
  }

  return (
    <NextStepTemplate
      prompt={t('Are you happy with this root cause?')}
      labelYes={t('Yes, make an implementation plan')}
      onClickYes={handleYesClick}
      labelNo={t('No')}
      onClickNo={handleNoClick}
      placeholderPrompt={t('Give seer additional context to improve this root cause.')}
      rethinkPrompt={t('How can this root cause be improved?')}
      labelNevermind={t('Nevermind, make an implementation plan')}
      labelRethink={t('Rethink root cause')}
    />
  );
}

function SolutionNextStep({autofix, runId, section}: NextStepProps) {
  const {startStep} = autofix;

  const handleYesClick = useCallback(() => {
    startStep('code_changes', runId);
  }, [startStep, runId]);

  const handleNoClick = useCallback(
    (userContext: string) => {
      startStep('solution', runId, userContext);
    },
    [startStep, runId]
  );

  const artifact = useMemo(
    () => section.artifacts.findLast(isSolutionArtifact),
    [section.artifacts]
  );

  if (!defined(artifact)) {
    return null;
  }

  return (
    <NextStepTemplate
      prompt={t('Are you happy with this implementation plan?')}
      labelYes={t('Yes, write a code fix')}
      onClickYes={handleYesClick}
      labelNo={t('No')}
      onClickNo={handleNoClick}
      placeholderPrompt={t(
        'Give seer additional context to improve this implementation plan.'
      )}
      rethinkPrompt={t('How can this implementation plan be improved?')}
      labelNevermind={t('Nevermind, write a code fix')}
      labelRethink={t('Rethink implementation plan')}
    />
  );
}

function CodeChangesNextStep({autofix, runId, section}: NextStepProps) {
  const {createPR, startStep} = autofix;

  const handleYesClick = useCallback(() => {
    createPR(runId);
  }, [createPR, runId]);

  const handleNoClick = useCallback(
    (userContext: string) => {
      startStep('code_changes', runId, userContext);
    },
    [startStep, runId]
  );

  const artifact = useMemo(
    () => section.artifacts.findLast(isCodeChangesArtifact),
    [section.artifacts]
  );

  if (!defined(artifact)) {
    return null;
  }

  return (
    <NextStepTemplate
      prompt={t('Are you happy with these code changes?')}
      labelYes={t('Yes, draft a PR')}
      onClickYes={handleYesClick}
      labelNo={t('No')}
      onClickNo={handleNoClick}
      placeholderPrompt={t('Give seer additional context to improve this code change.')}
      rethinkPrompt={t('How can this code change be improved?')}
      labelNevermind={t('Nevermind, draft a PR')}
      labelRethink={t('Rethink code changes')}
    />
  );
}

interface NextStepTemplateProps {
  labelNevermind: ReactNode;
  labelNo: ReactNode;
  labelRethink: ReactNode;
  labelYes: ReactNode;
  onClickNo: (prompt: string) => void;
  onClickYes: () => void;
  placeholderPrompt: string;
  prompt: ReactNode;
  rethinkPrompt: ReactNode;
}

function NextStepTemplate({
  prompt,
  labelYes,
  onClickYes,
  labelNo,
  onClickNo,
  placeholderPrompt,
  rethinkPrompt,
  labelNevermind,
  labelRethink,
}: NextStepTemplateProps) {
  const [clickedNo, handleClickedNo] = useState(false);
  const [userContext, setUserContext] = useState('');

  if (clickedNo) {
    return (
      <Flex direction="column" gap="lg">
        <Text>{rethinkPrompt}</Text>
        <TextArea
          autosize
          rows={2}
          placeholder={placeholderPrompt}
          value={userContext}
          onChange={event => setUserContext(event.target.value)}
        />
        <Flex gap="md">
          <Button onClick={onClickYes}>{labelNevermind}</Button>
          <Button priority="primary" onClick={() => onClickNo(userContext)}>
            {labelRethink}
          </Button>
        </Flex>
      </Flex>
    );
  }

  return (
    <Flex direction="column" gap="lg">
      <Text>{prompt}</Text>
      <Flex gap="md">
        <Button onClick={() => handleClickedNo(true)}>{labelNo}</Button>
        <Button priority="primary" onClick={onClickYes}>
          {labelYes}
        </Button>
      </Flex>
    </Flex>
  );
}
