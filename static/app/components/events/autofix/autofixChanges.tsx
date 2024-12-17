import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, type AnimationProps, motion} from 'framer-motion';

import ClippedBox from 'sentry/components/clippedBox';
import {AutofixDiff} from 'sentry/components/events/autofix/autofixDiff';
import {SetupAndCreatePRsButton} from 'sentry/components/events/autofix/autofixPrButton';
import {AutofixViewPrButton} from 'sentry/components/events/autofix/autofixViewPrButton';
import {
  type AutofixChangesStep,
  type AutofixCodebaseChange,
  AutofixStatus,
} from 'sentry/components/events/autofix/types';
import {useAutofixData} from 'sentry/components/events/autofix/useAutofix';
import {IconChevron, IconFix} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import testableTransition from 'sentry/utils/testableTransition';

type AutofixChangesProps = {
  changesVersionIndex: number;
  groupId: string;
  hasMoreThanOneChangesStep: boolean;
  hasStepBelow: boolean;
  runId: string;
  step: AutofixChangesStep;
};

function AutofixRepoChange({
  change,
  groupId,
  runId,
}: {
  change: AutofixCodebaseChange;
  groupId: string;
  runId: string;
}) {
  return (
    <RepoChangeContent>
      <RepoChangesHeader>
        <div>
          <Title>{change.title}</Title>
          <PullRequestTitle>{change.repo_name}</PullRequestTitle>
        </div>
        {change.pull_request && (
          <AutofixViewPrButton
            repoName={change.repo_name}
            prUrl={change.pull_request?.pr_url}
          />
        )}
      </RepoChangesHeader>
      <AutofixDiff
        diff={change.diff}
        groupId={groupId}
        runId={runId}
        repoId={change.repo_external_id}
        editable={!change.pull_request}
      />
    </RepoChangeContent>
  );
}

const cardAnimationProps: AnimationProps = {
  exit: {opacity: 0, height: 0, scale: 0.8, y: -20},
  initial: {opacity: 0, height: 0, scale: 0.8},
  animate: {opacity: 1, height: 'auto', scale: 1},
  transition: testableTransition({
    duration: 1.0,
    height: {
      type: 'spring',
      bounce: 0.2,
    },
    scale: {
      type: 'spring',
      bounce: 0.2,
    },
    y: {
      type: 'tween',
      ease: 'easeOut',
    },
  }),
};

export function AutofixChanges({
  step,
  groupId,
  runId,
  hasStepBelow,
  changesVersionIndex,
  hasMoreThanOneChangesStep,
}: AutofixChangesProps) {
  const data = useAutofixData({groupId});
  const [isExpanded, setIsExpanded] = useState(!hasStepBelow);

  if (step.status === 'ERROR' || data?.status === 'ERROR') {
    return (
      <RepoChangeContent>
        <PreviewContent>
          {data?.error_message ? (
            <Fragment>
              <PrefixText>{t('Something went wrong')}</PrefixText>
              <span>{data.error_message}</span>
            </Fragment>
          ) : (
            <span>{t('Something went wrong.')}</span>
          )}
        </PreviewContent>
      </RepoChangeContent>
    );
  }

  if (
    step.status === AutofixStatus.COMPLETED &&
    Object.keys(step.codebase_changes).length === 0
  ) {
    return (
      <RepoChangeContent>
        <PreviewContent>
          <span>{t('Could not find a fix.')}</span>
        </PreviewContent>
      </RepoChangeContent>
    );
  }

  const allChangesHavePullRequests = Object.values(step.codebase_changes).every(
    change => change.pull_request
  );

  const changesText = hasMoreThanOneChangesStep
    ? hasStepBelow
      ? t('Changes (version %s)', changesVersionIndex + 1)
      : t('Latest Changes (version %s)', changesVersionIndex + 1)
    : t('Changes');

  return (
    <AnimatePresence initial>
      <AnimationWrapper key="card" {...cardAnimationProps}>
        <ChangesContainer
          allChangesHavePullRequests={allChangesHavePullRequests}
          hasStepBelow={hasStepBelow}
        >
          <HeaderRow
            onClick={() => hasStepBelow && setIsExpanded(!isExpanded)}
            role={hasStepBelow ? 'button' : undefined}
            aria-expanded={hasStepBelow ? isExpanded : undefined}
            expandable={hasStepBelow}
          >
            <HeaderTextWrapper>
              <HeaderText isPreviousChanges={hasStepBelow}>
                <IconFix size="sm" />
                {changesText}
              </HeaderText>
            </HeaderTextWrapper>
            <HeaderButtonsWrapper>
              {(!hasStepBelow || isExpanded) && !allChangesHavePullRequests && (
                <SetupAndCreatePRsButton
                  changes={Object.values(step.codebase_changes)}
                  groupId={groupId}
                  hasStepBelow={hasStepBelow}
                  changesStepId={step.id}
                />
              )}
              {hasStepBelow && (
                <CollapseButton
                  aria-label={isExpanded ? t('Collapse changes') : t('Expand changes')}
                >
                  <IconChevron direction={isExpanded ? 'up' : 'down'} size="sm" />
                </CollapseButton>
              )}
            </HeaderButtonsWrapper>
          </HeaderRow>
          {(!hasStepBelow || isExpanded) && (
            <ClippedBox clipHeight={408}>
              {Object.values(step.codebase_changes).map((change, i) => (
                <Fragment key={change.repo_external_id}>
                  {i > 0 && <Separator />}
                  <AutofixRepoChange change={change} groupId={groupId} runId={runId} />
                </Fragment>
              ))}
            </ClippedBox>
          )}
        </ChangesContainer>
      </AnimationWrapper>
    </AnimatePresence>
  );
}

const PreviewContent = styled('div')`
  display: flex;
  flex-direction: column;
  color: ${p => p.theme.textColor};
  margin-top: ${space(2)};
`;

const AnimationWrapper = styled(motion.div)`
  transform-origin: top center;
`;

const PrefixText = styled('span')``;

const ChangesContainer = styled('div')<{
  allChangesHavePullRequests: boolean;
  hasStepBelow?: boolean;
}>`
  border: ${p => (p.hasStepBelow ? 1 : 2)}px solid
    ${p =>
      p.hasStepBelow
        ? p.theme.innerBorder
        : p.allChangesHavePullRequests
          ? p.theme.alert.success.border
          : p.theme.alert.info.border};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: ${p => p.theme.dropShadowMedium};
  overflow: hidden;
`;

const RepoChangeContent = styled('div')`
  padding: 0 ${space(2)} ${space(2)} ${space(2)};
`;

const Title = styled('div')`
  font-weight: ${p => p.theme.fontWeightBold};
  margin-bottom: ${space(0.5)};
`;

const PullRequestTitle = styled('div')`
  color: ${p => p.theme.subText};
`;

const RepoChangesHeader = styled('div')`
  padding: ${space(2)} 0;
  display: flex;
  align-items: start;
  justify-content: space-between;
`;

const Separator = styled('hr')`
  border: none;
  border-top: 1px solid ${p => p.theme.innerBorder};
  margin: ${space(2)} -${space(2)} 0 -${space(2)};
`;

const HeaderRow = styled('div')<{expandable?: boolean}>`
  display: flex;
  align-items: center;
  width: 100%;
  justify-content: space-between;
  gap: ${space(1)};
  height: calc((2 * ${space(2)}) + ${p => p.theme.form.sm.height}px);
  padding: ${space(2)};
  cursor: ${p => (p.expandable ? 'pointer' : 'default')};

  &:hover {
    background-color: ${p =>
      p.expandable ? p.theme.backgroundSecondary : 'transparent'};
  }
`;

const HeaderButtonsWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const HeaderText = styled('div')<{isPreviousChanges?: boolean}>`
  font-weight: bold;
  font-size: ${p => (p.isPreviousChanges ? 1.1 : 1.2)}em;
  color: ${p => (p.isPreviousChanges ? p.theme.subText : p.theme.textColor)};
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const HeaderTextWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const CollapseButton = styled('button')`
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  color: ${p => p.theme.subText};
  display: flex;
  align-items: center;

  &:hover {
    color: ${p => p.theme.textColor};
  }
`;
