import {Fragment, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import UserAvatar from 'sentry/components/avatar/userAvatar';
import {Button} from 'sentry/components/button';
import {DateTime} from 'sentry/components/dateTime';
import {AutofixChanges} from 'sentry/components/events/autofix/autofixChanges';
import {AutofixInputField} from 'sentry/components/events/autofix/autofixInputField';
import {AutofixRootCause} from 'sentry/components/events/autofix/autofixRootCause';
import {
  type AutofixData,
  type AutofixProgressItem,
  type AutofixRepository,
  type AutofixStep,
  AutofixStepType,
  type AutofixUserResponseStep,
} from 'sentry/components/events/autofix/types';
import {useAutofixData} from 'sentry/components/events/autofix/useAutofix';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import {
  IconCheckmark,
  IconChevron,
  IconClose,
  IconCode,
  IconFatal,
  IconQuestion,
  IconSad,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import marked, {singleLineRenderer} from 'sentry/utils/marked';
import usePrevious from 'sentry/utils/usePrevious';

function StepIcon({step}: {step: AutofixStep}) {
  if (step.type === AutofixStepType.CHANGES) {
    return <IconCode size="sm" color="gray300" />;
  }

  if (step.type === AutofixStepType.ROOT_CAUSE_ANALYSIS) {
    if (step.causes?.length === 0) {
      return <IconSad size="sm" color="gray300" />;
    }
    return step.selection ? (
      <IconCheckmark size="sm" color="green300" isCircled />
    ) : (
      <IconQuestion size="sm" color="gray300" />
    );
  }

  switch (step.status) {
    case 'PROCESSING':
      return <ProcessingStatusIndicator size={14} mini hideMessage />;
    case 'CANCELLED':
      return <IconClose size="sm" isCircled color="gray300" />;
    case 'ERROR':
      return <IconFatal size="sm" color="red300" />;
    case 'COMPLETED':
      return <IconCheckmark size="sm" color="green300" isCircled />;
    default:
      return null;
  }
}

function stepShouldBeginExpanded(step: AutofixStep, isLastStep?: boolean) {
  if (isLastStep) {
    return true;
  }

  if (step.type === AutofixStepType.ROOT_CAUSE_ANALYSIS) {
    return step.selection ? false : true;
  }

  return step.status !== 'COMPLETED';
}

interface StepProps {
  groupId: string;
  onRetry: () => void;
  repos: AutofixRepository[];
  runId: string;
  step: AutofixStep;
  isChild?: boolean;
  isLastStep?: boolean;
  stepNumber?: number;
}

interface UserStepProps extends StepProps {
  step: AutofixUserResponseStep;
}

interface AutofixStepsProps {
  data: AutofixData;
  groupId: string;
  onRetry: () => void;
  runId: string;
}

function isProgressLog(
  item: AutofixProgressItem | AutofixStep
): item is AutofixProgressItem {
  return 'message' in item && 'timestamp' in item;
}

function replaceHeadersWithBold(markdown: string) {
  const headerRegex = /^(#{1,6})\s+(.*)$/gm;
  const boldMarkdown = markdown.replace(headerRegex, (_match, _hashes, content) => {
    return ` **${content}** `;
  });

  return boldMarkdown;
}

function Progress({
  progress,
  groupId,
  runId,
  onRetry,
  repos,
}: {
  groupId: string;
  onRetry: () => void;
  progress: AutofixProgressItem | AutofixStep;
  repos: AutofixRepository[];
  runId: string;
}) {
  if (isProgressLog(progress)) {
    const html = progress.message.includes('\n')
      ? marked(replaceHeadersWithBold(progress.message), {
          breaks: true,
          gfm: true,
        })
      : singleLineRenderer(replaceHeadersWithBold(progress.message), {
          breaks: true,
          gfm: true,
        });

    return (
      <Fragment>
        <DateTime date={progress.timestamp} format="HH:mm:ss:SSS" />
        <LogComponent html={html} />
      </Fragment>
    );
  }

  return (
    <ProgressStepContainer>
      <ExpandableStep
        step={progress}
        isChild
        groupId={groupId}
        runId={runId}
        onRetry={onRetry}
        repos={repos}
      />
    </ProgressStepContainer>
  );
}

export function ExpandableStep({
  step,
  isChild,
  groupId,
  runId,
  isLastStep,
  onRetry,
  repos,
}: StepProps) {
  const previousIsLastStep = usePrevious(isLastStep);
  const previousStepStatus = usePrevious(step.status);
  const isActive = step.status !== 'PENDING' && step.status !== 'CANCELLED';
  const [isExpanded, setIsExpanded] = useState(() =>
    stepShouldBeginExpanded(step, isLastStep)
  );

  useEffect(() => {
    if (
      (previousStepStatus &&
        previousStepStatus !== step.status &&
        step.status === 'COMPLETED') ||
      (previousIsLastStep && !isLastStep)
    ) {
      setIsExpanded(false);
    }
  }, [previousStepStatus, step.status, previousIsLastStep, isLastStep]);

  const logs: AutofixProgressItem[] = step.progress?.filter(isProgressLog) ?? [];
  const activeLog = step.completedMessage ?? logs.at(-1)?.message ?? null;
  const hasContent = Boolean(
    step.completedMessage ||
      step.progress?.length ||
      step.type !== AutofixStepType.DEFAULT
  );
  const canToggle = Boolean(isActive && hasContent);

  return (
    <StepCard active={isActive}>
      <StepHeader
        canToggle={canToggle}
        isChild={isChild}
        onClick={() => {
          if (canToggle) {
            setIsExpanded(value => !value);
          }
        }}
      >
        <StepHeaderLeft>
          <StepIconContainer>
            <StepIcon step={step} />
          </StepIconContainer>
          <StepTitle
            dangerouslySetInnerHTML={{
              __html: singleLineRenderer(step.title),
            }}
          />
          {activeLog && !isExpanded && (
            <StepHeaderDescription
              dangerouslySetInnerHTML={{
                __html: singleLineRenderer(
                  replaceHeadersWithBold(activeLog.replaceAll('\n', ' '))
                ),
              }}
            />
          )}
        </StepHeaderLeft>
        <StepHeaderRight>
          {canToggle ? (
            <Button
              icon={<IconChevron size="xs" direction={isExpanded ? 'down' : 'right'} />}
              aria-label={t('Toggle step details')}
              aria-expanded={isExpanded}
              size="zero"
              borderless
            />
          ) : null}
        </StepHeaderRight>
      </StepHeader>
      {isExpanded && (
        <Fragment>
          {step.completedMessage && <StepBody>{step.completedMessage}</StepBody>}
          {step.progress && step.progress.length > 0 ? (
            <ProgressContainer>
              {step.progress.map((progress, i) => (
                <Progress
                  progress={progress}
                  key={i}
                  groupId={groupId}
                  runId={runId}
                  onRetry={onRetry}
                  repos={repos}
                />
              ))}
            </ProgressContainer>
          ) : null}
          {step.type === AutofixStepType.ROOT_CAUSE_ANALYSIS && (
            <AutofixRootCause
              groupId={groupId}
              runId={runId}
              causes={step.causes}
              rootCauseSelection={step.selection}
              repos={repos}
            />
          )}
          {step.type === AutofixStepType.CHANGES && (
            <AutofixChanges
              step={step}
              groupId={groupId}
              onRetry={onRetry}
              isLastStep={isLastStep}
            />
          )}
        </Fragment>
      )}
    </StepCard>
  );
}

function UserStep({step, groupId}: UserStepProps) {
  const data = useAutofixData({groupId});
  const user = data?.users?.[step.user_id];

  return (
    <StepCard active>
      <UserStepContent>
        <UserAvatar user={user} size={19} />
        <UserTextContentContainer>
          <UserStepName>{user?.name}</UserStepName>
          <UserStepText>{step.text}</UserStepText>
        </UserTextContentContainer>
      </UserStepContent>
    </StepCard>
  );
}

function Step({step, groupId, runId, onRetry, stepNumber, isLastStep, repos}: StepProps) {
  if (step.type === AutofixStepType.USER_RESPONSE) {
    return (
      <UserStep
        step={step}
        groupId={groupId}
        runId={runId}
        onRetry={onRetry}
        isLastStep={isLastStep}
        repos={repos}
      />
    );
  }

  return (
    <ExpandableStep
      step={step}
      groupId={groupId}
      runId={runId}
      onRetry={onRetry}
      stepNumber={stepNumber}
      isLastStep={isLastStep}
      repos={repos}
    />
  );
}

export function AutofixSteps({data, groupId, runId, onRetry}: AutofixStepsProps) {
  const steps = data.steps;
  const repos = data.repositories;

  if (!steps) {
    return null;
  }

  const showInputField =
    data.options?.iterative_feedback && steps.at(-1)?.type === AutofixStepType.CHANGES;

  return (
    <div>
      {steps.map((step, index) => (
        <Step
          step={step}
          key={step.id}
          stepNumber={index + 1}
          groupId={groupId}
          runId={runId}
          onRetry={onRetry}
          isLastStep={index === steps.length - 1}
          repos={repos}
        />
      ))}
      {showInputField && <AutofixInputField runId={data.run_id} groupId={groupId} />}
    </div>
  );
}

const StepCard = styled(Panel)<{active?: boolean}>`
  opacity: ${p => (p.active ? 1 : 0.6)};
  overflow: hidden;

  :last-child {
    margin-bottom: 0;
  }
`;

const StepHeader = styled('div')<{canToggle: boolean; isChild?: boolean}>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${space(2)};
  gap: ${space(1)};
  font-size: ${p => p.theme.fontSizeMedium};
  font-family: ${p => p.theme.text.family};
  cursor: ${p => (p.canToggle ? 'pointer' : 'default')};

  &:last-child {
    padding-bottom: ${space(2)};
  }
`;

const UserStepContent = styled('div')`
  display: flex;
  align-items: flex-start;
  gap: ${space(1)};
  padding: ${space(2)};
`;

const UserStepName = styled('div')`
  font-weight: bold;
`;

const UserStepText = styled('p')`
  margin: 0;
`;

const UserTextContentContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

const StepHeaderLeft = styled('div')`
  display: flex;
  align-items: center;
  flex: 1;
  overflow: hidden;
`;

const StepHeaderDescription = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  padding: 0 ${space(2)} 0 ${space(1)};
  margin-left: ${space(1)};
  border-left: 1px solid ${p => p.theme.border};
  flex-grow: 1;
  ${p => p.theme.overflowEllipsis};
`;

const StepIconContainer = styled('div')`
  display: flex;
  align-items: center;
  margin-right: ${space(1.5)};
`;

const StepHeaderRight = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const StepTitle = styled('div')`
  font-weight: ${p => p.theme.fontWeightBold};
  white-space: nowrap;
  display: flex;
  flex-shrink: 1;
  align-items: center;
  flex-grow: 0;

  span {
    margin-right: ${space(1)};
  }
`;

const StepBody = styled('p')`
  padding: 0 ${space(2)} ${space(2)} ${space(2)};
  margin: -${space(1)} 0 0 0;
`;

const ProcessingStatusIndicator = styled(LoadingIndicator)`
  && {
    margin: 0;
    height: 14px;
    width: 14px;
  }
`;

const ProgressContainer = styled('div')`
  background: ${p => p.theme.backgroundSecondary};
  border-top: 1px solid ${p => p.theme.border};
  padding: ${space(2)};
  display: grid;
  gap: ${space(1)} ${space(2)};
  grid-template-columns: auto 1fr;
  font-size: ${p => p.theme.fontSizeSmall};
  font-family: ${p => p.theme.text.familyMono};
`;

const ProgressStepContainer = styled('div')`
  grid-column: 1/-1;
`;

function LogComponent({html}: {html: string}) {
  const [expanded, setExpanded] = useState(false);
  const [isExpandable, setIsExpandable] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkExpandable = () => {
      if (logRef.current) {
        const {scrollHeight, clientHeight} = logRef.current;
        setIsExpandable(scrollHeight > clientHeight + 16);
      }
    };

    checkExpandable();
    window.addEventListener('resize', checkExpandable);
    return () => window.removeEventListener('resize', checkExpandable);
  }, [html]);

  const toggleExpand = () => {
    setExpanded(oldState => !oldState);
  };

  return (
    <ExpandableLogRow>
      <LogText
        ref={logRef}
        expanded={expanded}
        isExpandable={isExpandable}
        dangerouslySetInnerHTML={{__html: html}}
      />
      {isExpandable && (
        <Button
          icon={<IconChevron size="xs" direction={expanded ? 'down' : 'right'} />}
          aria-label={t('Toggle step details')}
          aria-expanded={expanded}
          size="zero"
          borderless
          onClick={toggleExpand}
        />
      )}
    </ExpandableLogRow>
  );
}

const LogText = styled('div')<{expanded: boolean; isExpandable: boolean}>`
  overflow-x: auto;
  display: -webkit-box;
  -webkit-line-clamp: ${props => (props.expanded ? 'unset' : '2')};
  -webkit-box-orient: vertical;
  overflow-y: hidden;
  max-height: ${props => (props.expanded ? 'none' : '3em')};
  flex: 1;
`;

const ExpandableLogRow = styled('div')`
  overflow-x: scroll;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  width: 100%;
`;
