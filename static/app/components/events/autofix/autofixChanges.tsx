import {Fragment, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion, type MotionNodeAnimationOptions} from 'framer-motion';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import ClippedBox from 'sentry/components/clippedBox';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {AutofixDiff} from 'sentry/components/events/autofix/autofixDiff';
import AutofixHighlightPopup from 'sentry/components/events/autofix/autofixHighlightPopup';
import {AutofixHighlightWrapper} from 'sentry/components/events/autofix/autofixHighlightWrapper';
import {replaceHeadersWithBold} from 'sentry/components/events/autofix/autofixRootCause';
import {AutofixSetupWriteAccessModal} from 'sentry/components/events/autofix/autofixSetupWriteAccessModal';
import {AutofixStepFeedback} from 'sentry/components/events/autofix/autofixStepFeedback';
import {
  AutofixStatus,
  type AutofixChangesStep,
  type AutofixCodebaseChange,
  type CommentThread,
} from 'sentry/components/events/autofix/types';
import {
  makeAutofixQueryKey,
  useAutofixData,
  useAutofixRepos,
} from 'sentry/components/events/autofix/useAutofix';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {ScrollCarousel} from 'sentry/components/scrollCarousel';
import {IconChat, IconCode, IconCopy, IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {singleLineRenderer} from 'sentry/utils/marked/marked';
import {MarkedText} from 'sentry/utils/marked/markedText';
import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import testableTransition from 'sentry/utils/testableTransition';
import useApi from 'sentry/utils/useApi';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import useOrganization from 'sentry/utils/useOrganization';

type AutofixChangesProps = {
  groupId: string;
  runId: string;
  step: AutofixChangesStep;
  agentCommentThread?: CommentThread;
  isChangesFirstAppearance?: boolean;
  previousDefaultStepIndex?: number;
  previousInsightCount?: number;
};

function AutofixRepoChange({
  change,
  groupId,
  runId,
  previousDefaultStepIndex,
  previousInsightCount,
  ref,
}: {
  change: AutofixCodebaseChange;
  groupId: string;
  runId: string;
  previousDefaultStepIndex?: number;
  previousInsightCount?: number;
  ref?: React.RefObject<HTMLDivElement | null>;
}) {
  const changeDescriptionHtml = useMemo(() => {
    return {
      __html: singleLineRenderer(change.description),
    };
  }, [change.description]);

  return (
    <Content>
      <RepoChangesHeader>
        <div>
          <AutofixHighlightWrapper
            ref={ref}
            groupId={groupId}
            runId={runId}
            stepIndex={previousDefaultStepIndex ?? 0}
            retainInsightCardIndex={
              previousInsightCount !== undefined && previousInsightCount >= 0
                ? previousInsightCount
                : null
            }
          >
            <div>
              <PullRequestTitle>{change.repo_name}</PullRequestTitle>
              <Title>{change.title}</Title>
              <p dangerouslySetInnerHTML={changeDescriptionHtml} />
            </div>
          </AutofixHighlightWrapper>
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

const cardAnimationProps: MotionNodeAnimationOptions = {
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
  const {copy} = useCopyToClipboard();

  return (
    <CopyContainer>
      <CopyButton
        size="xs"
        disabled={!change.branch_name}
        onClick={() =>
          copy(change.branch_name ?? '', {
            successMessage: t('Branch name copied to clipboard.'),
          })
        }
        icon={<IconCopy size="xs" />}
        aria-label={t('Copy branch in %s', change.repo_name)}
        title={t('Copy branch in %s', change.repo_name)}
      />
      <CodeText>{change.branch_name}</CodeText>
    </CopyContainer>
  );
}

const CopyContainer = styled('div')`
  display: inline-flex;
  align-items: stretch;
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  background: ${p => p.theme.backgroundSecondary};
  max-width: 25rem;
  min-width: 0;
  flex: 1;
  flex-shrink: 1;
`;

const CopyButton = styled(Button)`
  border: none;
  border-radius: ${p => p.theme.radius.md} 0 0 ${p => p.theme.radius.md};
  border-right: 1px solid ${p => p.theme.tokens.border.primary};
  height: auto;
  flex-shrink: 0;
`;

const CodeText = styled('code')`
  font-family: ${p => p.theme.text.familyMono};
  padding: ${space(0.5)} ${space(1)};
  font-size: ${p => p.theme.fontSize.sm};
  display: block;
  min-width: 0;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export function AutofixChanges({
  step,
  groupId,
  runId,
  previousDefaultStepIndex,
  previousInsightCount,
  agentCommentThread,
  isChangesFirstAppearance,
}: AutofixChangesProps) {
  const {data} = useAutofixData({groupId});
  const isBusy = step.status === AutofixStatus.PROCESSING;
  const iconCodeRef = useRef<HTMLDivElement>(null);
  const firstChangeRef = useRef<HTMLDivElement | null>(null);
  const [isPrProcessing, setIsPrProcessing] = useState(false);
  const [isBranchProcessing, setIsBranchProcessing] = useState(false);

  const handleSelectFirstChange = () => {
    if (firstChangeRef.current) {
      // Simulate a click on the first change to trigger the text selection
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      });
      firstChangeRef.current.dispatchEvent(clickEvent);
    }
  };

  useEffect(() => {
    if (step.status === AutofixStatus.COMPLETED) {
      const prsNowExist =
        step.changes.length > 0 && step.changes.every(c => c.pull_request);
      const branchesNowExist =
        step.changes.length > 0 && step.changes.every(c => c.branch_name);

      if (prsNowExist) {
        setIsPrProcessing(false);
      }
      if (branchesNowExist) {
        setIsBranchProcessing(false);
      }
    }
  }, [step.status, step.changes]);

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
      <AnimatePresence initial={isChangesFirstAppearance}>
        <AnimationWrapper key="card" {...cardAnimationProps}>
          <NoChangesPadding>
            <Alert.Container>
              <MarkdownAlert
                text={
                  step.termination_reason
                    ? replaceHeadersWithBold(step.termination_reason)
                    : t('Seer had trouble applying its code changes.')
                }
              />
            </Alert.Container>
          </NoChangesPadding>
        </AnimationWrapper>
      </AnimatePresence>
    );
  }

  const prsMade =
    step.status === AutofixStatus.COMPLETED &&
    step.changes.length >= 1 &&
    step.changes.every(change => change.pull_request);

  const branchesMade =
    step.status === AutofixStatus.COMPLETED &&
    step.changes.length >= 1 &&
    step.changes.every(change => change.branch_name);

  return (
    <AnimatePresence initial={isChangesFirstAppearance}>
      <AnimationWrapper key="card" {...cardAnimationProps}>
        <ChangesContainer>
          <Flex justify="between" align="center" wrap="wrap" gap="md">
            <HeaderText>
              <Flex justify="center" align="center" ref={iconCodeRef}>
                <IconCode size="md" variant="accent" />
              </Flex>
              {t('Code Changes')}
              <Button
                size="zero"
                borderless
                title={t('Chat with Seer')}
                onClick={handleSelectFirstChange}
                analyticsEventName="Autofix: Changes Chat"
                analyticsEventKey="autofix.changes.chat"
              >
                <IconChat />
              </Button>
            </HeaderText>
          </Flex>
          <AnimatePresence>
            {agentCommentThread && iconCodeRef.current && (
              <AutofixHighlightPopup
                selectedText=""
                referenceElement={iconCodeRef.current}
                groupId={groupId}
                runId={runId}
                stepIndex={previousDefaultStepIndex ?? 0}
                retainInsightCardIndex={
                  previousInsightCount !== undefined && previousInsightCount >= 0
                    ? previousInsightCount
                    : null
                }
                isAgentComment
                blockName={t('Seer is uncertain of the code changes...')}
              />
            )}
          </AnimatePresence>
          <ClippedBox clipHeight={408}>
            {step.changes.map((change, i) => (
              <Fragment key={change.repo_external_id}>
                {i > 0 && <Separator />}
                <AutofixRepoChange
                  change={change}
                  groupId={groupId}
                  runId={runId}
                  previousDefaultStepIndex={previousDefaultStepIndex}
                  previousInsightCount={previousInsightCount}
                  ref={i === 0 ? firstChangeRef : undefined}
                />
              </Fragment>
            ))}
          </ClippedBox>
          <BottomDivider />
          <BottomButtonContainer hasTerminationReason={!!step.termination_reason}>
            {step.termination_reason && (
              <TerminationReasonText>{step.termination_reason}</TerminationReasonText>
            )}
            <Flex justify="end" align="center" gap="md">
              {!prsMade && (
                <ButtonBar>
                  {branchesMade ? (
                    step.changes.length === 1 && step.changes[0] ? (
                      <BranchButton change={step.changes[0]} />
                    ) : (
                      <ScrollCarousel aria-label={t('Check out branches')}>
                        {step.changes.map(
                          (change, idx) =>
                            change.branch_name && (
                              <BranchButton
                                key={`${change.repo_external_id}-${idx}`}
                                change={change}
                              />
                            )
                        )}
                      </ScrollCarousel>
                    )
                  ) : (
                    <SetupAndCreateBranchButton
                      changes={step.changes}
                      groupId={groupId}
                      runId={runId}
                      isBusy={isBusy || isPrProcessing}
                      onProcessingChange={setIsBranchProcessing}
                    />
                  )}
                  <SetupAndCreatePRsButton
                    changes={step.changes}
                    groupId={groupId}
                    runId={runId}
                    isBusy={isBusy || isBranchProcessing}
                    onProcessingChange={setIsPrProcessing}
                  />
                </ButtonBar>
              )}
              {step.status === AutofixStatus.COMPLETED && (
                <AutofixStepFeedback stepType="changes" groupId={groupId} runId={runId} />
              )}
              {prsMade &&
                (step.changes.length === 1 && step.changes[0]?.pull_request?.pr_url ? (
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
                  <ScrollCarousel aria-label={t('View pull requests')}>
                    {step.changes.map(
                      (change, idx) =>
                        change.pull_request?.pr_url && (
                          <LinkButton
                            key={`${change.repo_external_id}-${idx}`}
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
                  </ScrollCarousel>
                ))}
            </Flex>
          </BottomButtonContainer>
        </ChangesContainer>
      </AnimationWrapper>
    </AnimatePresence>
  );
}

const PreviewContent = styled('div')`
  display: flex;
  flex-direction: column;
  color: ${p => p.theme.tokens.content.primary};
  margin-top: ${space(2)};
`;

const AnimationWrapper = styled(motion.div)`
  transform-origin: top center;
`;

const PrefixText = styled('span')``;

const ChangesContainer = styled('div')`
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  box-shadow: ${p => p.theme.dropShadowMedium};
  padding: ${p => p.theme.space.xl};
  background: ${p => p.theme.tokens.background.primary};
`;

const Content = styled('div')`
  padding: 0 0 ${space(1)};
`;

const Title = styled('div')`
  font-weight: ${p => p.theme.fontWeight.bold};
  margin-top: ${space(1)};
  margin-bottom: ${space(1)};
  text-decoration: underline dashed;
  text-decoration-color: ${p => p.theme.colors.blue400};
  text-decoration-thickness: 1px;
  text-underline-offset: 4px;
`;

const PullRequestTitle = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
`;

const RepoChangesHeader = styled('div')`
  display: grid;
  align-items: center;
  grid-template-columns: 1fr auto;
`;

const MarkdownAlert = styled(MarkedText)`
  border: 1px solid ${p => p.theme.alert.warning.border};
  background-color: ${p => p.theme.alert.warning.backgroundLight};
  padding: ${space(2)} ${space(2)} 0 ${space(2)};
  border-radius: ${p => p.theme.radius.md};
  color: ${p => p.theme.alert.warning.color};
`;

const NoChangesPadding = styled('div')`
  padding: 0 ${space(2)};
`;

const Separator = styled('hr')`
  border: none;
  border-top: 1px solid ${p => p.theme.tokens.border.secondary};
  margin: ${space(2)} -${space(2)} 0 -${space(2)};
`;

const HeaderText = styled('div')`
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: ${p => p.theme.fontSize.lg};
  display: flex;
  align-items: center;
  gap: ${space(1)};
  margin-right: ${space(2)};
`;

const BottomDivider = styled('div')`
  border-top: 1px solid ${p => p.theme.tokens.border.secondary};
  margin-top: ${p => p.theme.space.xl};
  margin-bottom: ${p => p.theme.space.xl};
`;

const BottomButtonContainer = styled('div')<{hasTerminationReason?: boolean}>`
  display: flex;
  justify-content: ${p => (p.hasTerminationReason ? 'space-between' : 'flex-end')};
  align-items: center;
  gap: ${p => p.theme.space.xl};
`;

const TerminationReasonText = styled('div')`
  color: ${p => p.theme.tokens.content.danger};
  font-size: ${p => p.theme.fontSize.sm};
  flex: 1;
  min-width: 0;
`;

function CreatePRsButton({
  changes,
  groupId,
  runId,
  isBusy,
  onProcessingChange,
}: {
  changes: AutofixCodebaseChange[];
  groupId: string;
  isBusy: boolean;
  onProcessingChange: (processing: boolean) => void;
  runId: string;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [hasClicked, setHasClicked] = useState(false);
  const orgSlug = useOrganization().slug;

  // Reset hasClicked state and notify parent when isBusy goes from true to false
  useEffect(() => {
    if (!isBusy) {
      setHasClicked(false);
      onProcessingChange(false);
    }
  }, [isBusy, onProcessingChange]);

  const {mutate: createPr} = useMutation({
    mutationFn: ({change}: {change: AutofixCodebaseChange}) => {
      return api.requestPromise(
        `/organizations/${orgSlug}/issues/${groupId}/autofix/update/`,
        {
          method: 'POST',
          data: {
            run_id: runId,
            payload: {
              type: 'create_pr',
              repo_external_id: change.repo_external_id,
            },
          },
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: makeAutofixQueryKey(orgSlug, groupId, true),
      });
      queryClient.invalidateQueries({
        queryKey: makeAutofixQueryKey(orgSlug, groupId, false),
      });
      setHasClicked(true);
    },
    onError: () => {
      addErrorMessage(t('Failed to create a pull request'));
      setHasClicked(false);
      onProcessingChange(false);
    },
  });

  const createPRs = () => {
    setHasClicked(true);
    onProcessingChange(true);
    for (const change of changes) {
      createPr({change});
    }
  };

  return (
    <Button
      priority="primary"
      onClick={createPRs}
      icon={hasClicked && <LoadingIndicator size={14} />}
      size="sm"
      busy={isBusy || hasClicked}
      disabled={isBusy || hasClicked}
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
  isBusy,
  onProcessingChange,
}: {
  changes: AutofixCodebaseChange[];
  groupId: string;
  isBusy: boolean;
  onProcessingChange: (processing: boolean) => void;
  runId: string;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [hasClicked, setHasClicked] = useState(false);
  const orgSlug = useOrganization().slug;

  // Reset hasClicked state and notify parent when isBusy goes from true to false
  useEffect(() => {
    if (!isBusy) {
      setHasClicked(false);
      onProcessingChange(false);
    }
  }, [isBusy, onProcessingChange]);

  const {mutate: createBranch} = useMutation({
    mutationFn: ({change}: {change: AutofixCodebaseChange}) => {
      return api.requestPromise(
        `/organizations/${orgSlug}/issues/${groupId}/autofix/update/`,
        {
          method: 'POST',
          data: {
            run_id: runId,
            payload: {
              type: 'create_branch',
              repo_external_id: change.repo_external_id,
            },
          },
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: makeAutofixQueryKey(orgSlug, groupId, true),
      });
      queryClient.invalidateQueries({
        queryKey: makeAutofixQueryKey(orgSlug, groupId, false),
      });
    },
    onError: () => {
      addErrorMessage(t('Failed to push to branches.'));
      setHasClicked(false);
      onProcessingChange(false);
    },
  });

  const pushToBranch = () => {
    setHasClicked(true);
    onProcessingChange(true);
    for (const change of changes) {
      createBranch({change});
    }
  };

  return (
    <Button
      onClick={pushToBranch}
      icon={hasClicked && <LoadingIndicator size={14} />}
      size="sm"
      busy={isBusy || hasClicked}
      disabled={isBusy || hasClicked}
      analyticsEventName="Autofix: Push to Branch Clicked"
      analyticsEventKey="autofix.push_to_branch_clicked"
      analyticsParams={{group_id: groupId}}
    >
      {t('Check Out Locally')}
    </Button>
  );
}

function SetupAndCreateBranchButton({
  changes,
  groupId,
  runId,
  isBusy,
  onProcessingChange,
}: {
  changes: AutofixCodebaseChange[];
  groupId: string;
  isBusy: boolean;
  onProcessingChange: (processing: boolean) => void;
  runId: string;
}) {
  const {codebases} = useAutofixRepos(groupId);

  if (
    !changes.every(
      change =>
        change.repo_external_id && codebases[change.repo_external_id]?.is_writeable
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

  return (
    <CreateBranchButton
      changes={changes}
      groupId={groupId}
      runId={runId}
      isBusy={isBusy}
      onProcessingChange={onProcessingChange}
    />
  );
}

function SetupAndCreatePRsButton({
  changes,
  groupId,
  runId,
  isBusy,
  onProcessingChange,
}: {
  changes: AutofixCodebaseChange[];
  groupId: string;
  isBusy: boolean;
  onProcessingChange: (processing: boolean) => void;
  runId: string;
}) {
  const {codebases} = useAutofixRepos(groupId);
  if (
    !changes.every(
      change =>
        change.repo_external_id && codebases[change.repo_external_id]?.is_writeable
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

  return (
    <CreatePRsButton
      changes={changes}
      groupId={groupId}
      runId={runId}
      isBusy={isBusy}
      onProcessingChange={onProcessingChange}
    />
  );
}
