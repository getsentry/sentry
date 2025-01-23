import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, type AnimationProps, motion} from 'framer-motion';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import ClippedBox from 'sentry/components/clippedBox';
import {AutofixDiff} from 'sentry/components/events/autofix/autofixDiff';
import {useUpdateInsightCard} from 'sentry/components/events/autofix/autofixInsightCards';
import {AutofixSetupWriteAccessModal} from 'sentry/components/events/autofix/autofixSetupWriteAccessModal';
import {
  type AutofixChangesStep,
  type AutofixCodebaseChange,
  AutofixStatus,
  AutofixStepType,
} from 'sentry/components/events/autofix/types';
import {
  makeAutofixQueryKey,
  useAutofixData,
} from 'sentry/components/events/autofix/useAutofix';
import {useAutofixSetup} from 'sentry/components/events/autofix/useAutofixSetup';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {ScrollCarousel} from 'sentry/components/scrollCarousel';
import {IconCopy, IconFix, IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import testableTransition from 'sentry/utils/testableTransition';
import useApi from 'sentry/utils/useApi';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';

type AutofixChangesProps = {
  groupId: string;
  runId: string;
  step: AutofixChangesStep;
  previousDefaultStepIndex?: number;
  previousInsightCount?: number;
};

function AutofixRepoChange({
  change,
  groupId,
  runId,
  previousDefaultStepIndex,
  previousInsightCount,
}: {
  change: AutofixCodebaseChange;
  groupId: string;
  runId: string;
  previousDefaultStepIndex?: number;
  previousInsightCount?: number;
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
        previousDefaultStepIndex={previousDefaultStepIndex}
        previousInsightCount={previousInsightCount}
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

function BranchButton({change}: {change: AutofixCodebaseChange}) {
  const {onClick} = useCopyToClipboard({
    text: `git fetch --all && git switch ${change.branch_name}`,
    successMessage: t('Command copied. Next stop: your terminal.'),
  });

  return (
    <Button
      key={`${change.repo_external_id}-${Math.random()}`}
      size="xs"
      priority="primary"
      onClick={onClick}
      aria-label={t('Check out in %s', change.repo_name)}
      title={t('git fetch --all && git switch %s', change.branch_name)}
      icon={<IconCopy size="xs" />}
    >
      {t('Check out in %s', change.repo_name)}
    </Button>
  );
}

function CreatePRsButton({
  changes,
  groupId,
  runId,
}: {
  changes: AutofixCodebaseChange[];
  groupId: string;
  runId: string;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [hasClickedCreatePr, setHasClickedCreatePr] = useState(false);

  const createPRs = () => {
    setHasClickedCreatePr(true);
    for (const change of changes) {
      createPr({change});
    }
  };

  const {mutate: createPr} = useMutation({
    mutationFn: ({change}: {change: AutofixCodebaseChange}) => {
      return api.requestPromise(`/issues/${groupId}/autofix/update/`, {
        method: 'POST',
        data: {
          run_id: runId,
          payload: {
            type: 'create_pr',
            repo_external_id: change.repo_external_id,
          },
        },
      });
    },
    onSuccess: () => {
      addSuccessMessage(t('Created pull requests.'));
      queryClient.invalidateQueries({queryKey: makeAutofixQueryKey(groupId)});
    },
    onError: () => {
      setHasClickedCreatePr(false);
      addErrorMessage(t('Failed to create a pull request'));
    },
  });

  return (
    <Button
      priority="primary"
      onClick={createPRs}
      icon={
        hasClickedCreatePr && <ProcessingStatusIndicator size={14} mini hideMessage />
      }
      size="sm"
      busy={hasClickedCreatePr}
      analyticsEventName="Autofix: Create PR Clicked"
      analyticsEventKey="autofix.create_pr_clicked"
      analyticsParams={{group_id: groupId}}
    >
      Draft PR{changes.length > 1 ? 's' : ''}
    </Button>
  );
}

function CreateBranchButton({
  changes,
  groupId,
  runId,
}: {
  changes: AutofixCodebaseChange[];
  groupId: string;
  runId: string;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [hasClickedPushToBranch, setHasClickedPushToBranch] = useState(false);

  const pushToBranch = () => {
    setHasClickedPushToBranch(true);
    for (const change of changes) {
      createBranch({change});
    }
  };

  const {mutate: createBranch} = useMutation({
    mutationFn: ({change}: {change: AutofixCodebaseChange}) => {
      return api.requestPromise(`/issues/${groupId}/autofix/update/`, {
        method: 'POST',
        data: {
          run_id: runId,
          payload: {
            type: 'create_branch',
            repo_external_id: change.repo_external_id,
          },
        },
      });
    },
    onSuccess: () => {
      addSuccessMessage(t('Pushed to branches.'));
      queryClient.invalidateQueries({queryKey: makeAutofixQueryKey(groupId)});
    },
    onError: () => {
      setHasClickedPushToBranch(false);
      addErrorMessage(t('Failed to push to branches.'));
    },
  });

  return (
    <Button
      onClick={pushToBranch}
      icon={
        hasClickedPushToBranch && <ProcessingStatusIndicator size={14} mini hideMessage />
      }
      size="sm"
      busy={hasClickedPushToBranch}
      analyticsEventName="Autofix: Push to Branch Clicked"
      analyticsEventKey="autofix.push_to_branch_clicked"
      analyticsParams={{group_id: groupId}}
    >
      Check Out Locally
    </Button>
  );
}

function SetupAndCreateBranchButton({
  changes,
  groupId,
  runId,
}: {
  changes: AutofixCodebaseChange[];
  groupId: string;
  runId: string;
}) {
  const {data: setupData} = useAutofixSetup({groupId, checkWriteAccess: true});

  if (
    !changes.every(
      change =>
        setupData?.githubWriteIntegration?.repos?.find(
          repo => `${repo.owner}/${repo.name}` === change.repo_name
        )?.ok
    )
  ) {
    return (
      <Button
        onClick={() => {
          openModal(deps => <AutofixSetupWriteAccessModal {...deps} groupId={groupId} />);
        }}
        size="sm"
        analyticsEventName="Autofix: Create Branch Setup Clicked"
        analyticsEventKey="autofix.create_branch_setup_clicked"
        analyticsParams={{group_id: groupId}}
        title={t('Enable write access to create branches')}
      >
        {t('Check Out Locally')}
      </Button>
    );
  }

  return <CreateBranchButton changes={changes} groupId={groupId} runId={runId} />;
}

function SetupAndCreatePRsButton({
  changes,
  groupId,
  runId,
}: {
  changes: AutofixCodebaseChange[];
  groupId: string;
  runId: string;
}) {
  const {data: setupData} = useAutofixSetup({groupId, checkWriteAccess: true});

  if (
    !changes.every(
      change =>
        setupData?.githubWriteIntegration?.repos?.find(
          repo => `${repo.owner}/${repo.name}` === change.repo_name
        )?.ok
    )
  ) {
    return (
      <Button
        priority="primary"
        onClick={() => {
          openModal(deps => <AutofixSetupWriteAccessModal {...deps} groupId={groupId} />);
        }}
        size="sm"
        analyticsEventName="Autofix: Create PR Setup Clicked"
        analyticsEventKey="autofix.create_pr_setup_clicked"
        analyticsParams={{group_id: groupId}}
        title={t('Enable write access to create pull requests')}
      >
        {t('Draft PR')}
      </Button>
    );
  }

  return <CreatePRsButton changes={changes} groupId={groupId} runId={runId} />;
}

export function AutofixChanges({
  step,
  groupId,
  runId,
  previousDefaultStepIndex,
  previousInsightCount,
}: AutofixChangesProps) {
  const data = useAutofixData({groupId});

  const {mutate: sendFeedbackOnChanges} = useUpdateInsightCard({groupId, runId});

  const handleAddTests = () => {
    const planStep = data?.steps?.[data.steps.length - 2];
    if (!planStep || planStep.type !== AutofixStepType.DEFAULT) {
      return;
    }

    sendFeedbackOnChanges({
      step_index: planStep.index,
      retain_insight_card_index: planStep.insights.length - 1,
      message:
        'Please write a unit test that reproduces the issue to make sure it is fixed. Put it in the appropriate test file in the codebase. If there is none, create one.',
    });
  };

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

  const prsMade =
    step.status === AutofixStatus.COMPLETED &&
    step.changes.length >= 1 &&
    step.changes.every(change => change.pull_request);

  const branchesMade =
    !prsMade &&
    step.status === AutofixStatus.COMPLETED &&
    step.changes.length >= 1 &&
    step.changes.every(change => change.branch_name);

  return (
    <AnimatePresence initial>
      <AnimationWrapper key="card" {...cardAnimationProps}>
        <ChangesContainer allChangesHavePullRequests={allChangesHavePullRequests}>
          <ClippedBox clipHeight={408}>
            <HeaderWrapper>
              <HeaderText>
                <IconFix size="sm" />
                {t('Fixes')}
              </HeaderText>
              {!prsMade && !branchesMade ? (
                <ButtonBar gap={1}>
                  <Button
                    size="sm"
                    onClick={handleAddTests}
                    analyticsEventName="Autofix: Add Tests Clicked"
                    analyticsEventKey="autofix.add_tests_clicked"
                    analyticsParams={{group_id: groupId}}
                  >
                    {t('Add Tests')}
                  </Button>
                  <SetupAndCreateBranchButton
                    changes={step.changes}
                    groupId={groupId}
                    runId={runId}
                  />
                  <SetupAndCreatePRsButton
                    changes={step.changes}
                    groupId={groupId}
                    runId={runId}
                  />
                </ButtonBar>
              ) : prsMade ? (
                step.changes.length === 1 &&
                step.changes[0] &&
                step.changes[0].pull_request?.pr_url ? (
                  <LinkButton
                    size="xs"
                    priority="primary"
                    icon={<IconOpen size="xs" />}
                    href={step.changes[0].pull_request.pr_url}
                    external
                  >
                    View PR in {step.changes[0].repo_name}
                  </LinkButton>
                ) : (
                  <StyledScrollCarousel aria-label={t('View pull requests')}>
                    {step.changes.map(
                      change =>
                        change.pull_request?.pr_url && (
                          <LinkButton
                            key={`${change.repo_external_id}-${Math.random()}`}
                            size="xs"
                            priority="primary"
                            icon={<IconOpen size="xs" />}
                            href={change.pull_request.pr_url}
                            external
                          >
                            View PR in {change.repo_name}
                          </LinkButton>
                        )
                    )}
                  </StyledScrollCarousel>
                )
              ) : branchesMade ? (
                step.changes.length === 1 && step.changes[0] ? (
                  <BranchButton change={step.changes[0]} />
                ) : (
                  <StyledScrollCarousel aria-label={t('Check out branches')}>
                    {step.changes.map(
                      change =>
                        change.branch_name && (
                          <BranchButton
                            key={`${change.repo_external_id}-${Math.random()}`}
                            change={change}
                          />
                        )
                    )}
                  </StyledScrollCarousel>
                )
              ) : null}
            </HeaderWrapper>
            {step.changes.map((change, i) => (
              <Fragment key={change.repo_external_id}>
                {i > 0 && <Separator />}
                <AutofixRepoChange
                  change={change}
                  groupId={groupId}
                  runId={runId}
                  previousDefaultStepIndex={previousDefaultStepIndex}
                  previousInsightCount={previousInsightCount}
                />
              </Fragment>
            ))}
          </ClippedBox>
        </ChangesContainer>
      </AnimationWrapper>
    </AnimatePresence>
  );
}

const StyledScrollCarousel = styled(ScrollCarousel)`
  padding: 0 ${space(1)};
`;

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

const HeaderWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 ${space(1)} ${space(1)} ${space(1)};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const ProcessingStatusIndicator = styled(LoadingIndicator)`
  && {
    margin: 0;
    height: 14px;
    width: 14px;
  }
`;
