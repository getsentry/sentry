import {Fragment} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, type AnimationProps, motion} from 'framer-motion';

import ClippedBox from 'sentry/components/clippedBox';
import {AutofixDiff} from 'sentry/components/events/autofix/autofixDiff';
import type {
  AutofixChangesStep,
  AutofixCodebaseChange,
} from 'sentry/components/events/autofix/types';
import {useAutofixData} from 'sentry/components/events/autofix/useAutofix';
import {IconFix} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import testableTransition from 'sentry/utils/testableTransition';

type AutofixChangesProps = {
  groupId: string;
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
    <Content>
      <RepoChangesHeader>
        <div>
          <Title>{change.title}</Title>
          <PullRequestTitle>{change.repo_name}</PullRequestTitle>
        </div>
      </RepoChangesHeader>
      <AutofixDiff
        diff={change.diff}
        groupId={groupId}
        runId={runId}
        repoId={change.repo_external_id}
        editable={!change.pull_request}
      />
    </Content>
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

export function AutofixChanges({step, groupId, runId}: AutofixChangesProps) {
  const data = useAutofixData({groupId});

  if (step.status === 'ERROR' || data?.status === 'ERROR') {
    return (
      <Content>
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
      </Content>
    );
  }

  if (!step.changes.length) {
    return (
      <Content>
        <PreviewContent>
          <span>{t('Could not find a fix.')}</span>
        </PreviewContent>
      </Content>
    );
  }

  const allChangesHavePullRequests = step.changes.every(change => change.pull_request);

  return (
    <AnimatePresence initial>
      <AnimationWrapper key="card" {...cardAnimationProps}>
        <ChangesContainer allChangesHavePullRequests={allChangesHavePullRequests}>
          <ClippedBox clipHeight={408}>
            <HeaderText>
              <IconFix size="sm" />
              {t('Fixes')}
            </HeaderText>
            {step.changes.map((change, i) => (
              <Fragment key={change.repo_external_id}>
                {i > 0 && <Separator />}
                <AutofixRepoChange change={change} groupId={groupId} runId={runId} />
              </Fragment>
            ))}
          </ClippedBox>
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

const ChangesContainer = styled('div')<{allChangesHavePullRequests: boolean}>`
  border: 2px solid
    ${p =>
      p.allChangesHavePullRequests
        ? p.theme.alert.success.border
        : p.theme.alert.info.border};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: ${p => p.theme.dropShadowMedium};
  padding-left: ${space(2)};
  padding-right: ${space(2)};
  padding-top: ${space(1)};
`;

const Content = styled('div')`
  padding: 0 ${space(1)} ${space(1)} ${space(1)};
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
  display: grid;
  align-items: center;
  grid-template-columns: 1fr auto;
`;

const Separator = styled('hr')`
  border: none;
  border-top: 1px solid ${p => p.theme.innerBorder};
  margin: ${space(2)} -${space(2)} 0 -${space(2)};
`;

const HeaderText = styled('div')`
  font-weight: bold;
  font-size: 1.2em;
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;
