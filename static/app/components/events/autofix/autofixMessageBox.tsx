import {type FormEvent, Fragment, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, type AnimationProps, motion} from 'framer-motion';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {Button, LinkButton} from 'sentry/components/button';
import {AutofixSetupWriteAccessModal} from 'sentry/components/events/autofix/autofixSetupWriteAccessModal';
import {
  type AutofixCodebaseChange,
  type AutofixStep,
  AutofixStepType,
} from 'sentry/components/events/autofix/types';
import {
  type AutofixResponse,
  makeAutofixQueryKey,
  useAutofixData,
} from 'sentry/components/events/autofix/useAutofix';
import {useAutofixSetup} from 'sentry/components/events/autofix/useAutofixSetup';
import Input from 'sentry/components/input';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {ScrollCarousel} from 'sentry/components/scrollCarousel';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {
  IconCheckmark,
  IconChevron,
  IconClose,
  IconFatal,
  IconFocus,
  IconOpen,
  IconSad,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {singleLineRenderer} from 'sentry/utils/marked';
import {setApiQueryData, useMutation, useQueryClient} from 'sentry/utils/queryClient';
import testableTransition from 'sentry/utils/testableTransition';
import useApi from 'sentry/utils/useApi';

function useSendMessage({groupId, runId}: {groupId: string; runId: string}) {
  const api = useApi({persistInFlight: true});

  return useMutation({
    mutationFn: (params: {message: string}) => {
      return api.requestPromise(`/issues/${groupId}/autofix/update/`, {
        method: 'POST',
        data: {
          run_id: runId,
          payload: {
            type: 'user_message',
            text: params.message,
          },
        },
      });
    },
    onSuccess: _ => {
      addSuccessMessage('Thanks for the input.');
    },
    onError: () => {
      addErrorMessage(t('Something went wrong when sending Autofix your message.'));
    },
  });
}

interface AutofixMessageBoxProps {
  actionText: string;
  allowEmptyMessage: boolean;
  displayText: string;
  groupId: string;
  onSend: ((message: string, isCustom?: boolean) => void) | null;
  responseRequired: boolean;
  runId: string;
  step: AutofixStep | null;
  isChangesStep?: boolean;
  isRootCauseSelectionStep?: boolean;
  primaryAction?: boolean;
  scrollIntoView?: (() => void) | null;
  scrollText?: string;
}

function CreatePRsButton({
  changes,
  groupId,
}: {
  changes: AutofixCodebaseChange[];
  groupId: string;
}) {
  const autofixData = useAutofixData({groupId});
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
          run_id: autofixData?.run_id,
          payload: {
            type: 'create_pr',
            repo_external_id: change.repo_external_id,
            repo_id: change.repo_id, // The repo_id is only here for temporary backwards compatibility for LA customers, and we should remove it soon.
          },
        },
      });
    },
    onSuccess: () => {
      addSuccessMessage(t('Created pull requests.'));
      setApiQueryData<AutofixResponse>(
        queryClient,
        makeAutofixQueryKey(groupId),
        data => {
          if (!data || !data.autofix) {
            return data;
          }

          return {
            ...data,
            autofix: {
              ...data.autofix,
              status: 'PROCESSING',
            },
          };
        }
      );
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
      busy={hasClickedCreatePr}
      analyticsEventName="Autofix: Create PR Clicked"
      analyticsEventKey="autofix.create_pr_clicked"
      analyticsParams={{group_id: groupId}}
    >
      Create PR{changes.length > 1 ? 's' : ''}
    </Button>
  );
}

function SetupAndCreatePRsButton({
  changes,
  groupId,
}: {
  changes: AutofixCodebaseChange[];
  groupId: string;
}) {
  const {data: setupData} = useAutofixSetup({groupId});

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
        analyticsEventName="Autofix: Create PR Setup Clicked"
        analyticsEventKey="autofix.create_pr_setup_clicked"
        analyticsParams={{group_id: groupId}}
        title={t('Enable write access to create pull requests')}
      >
        {t('Create PRs')}
      </Button>
    );
  }

  return <CreatePRsButton changes={changes} groupId={groupId} />;
}

function StepIcon({step}: {step: AutofixStep}) {
  if (step.type === AutofixStepType.CHANGES) {
    if (step.changes?.length === 0) {
      return <IconSad size="sm" color="gray300" />;
    }
    if (step.changes.every(change => change.pull_request)) {
      return <IconCheckmark size="sm" color="green300" isCircled />;
    }
    return <IconFocus size="sm" color="gray300" />;
  }

  if (step.type === AutofixStepType.ROOT_CAUSE_ANALYSIS) {
    if (step.causes?.length === 0) {
      return <IconSad size="sm" color="gray300" />;
    }
    return step.selection ? (
      <IconCheckmark size="sm" color="green300" isCircled />
    ) : (
      <IconFocus size="sm" color="gray300" />
    );
  }

  switch (step.status) {
    case 'WAITING_FOR_USER_RESPONSE':
      return <IconFocus size="sm" color="gray300" />;
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

const animationProps: AnimationProps = {
  exit: {opacity: 0},
  initial: {opacity: 0, y: -20},
  animate: {opacity: 1, y: 0},
  transition: testableTransition({duration: 0.3}),
};

function AutofixMessageBox({
  displayText = '',
  step = null,
  primaryAction = false,
  responseRequired = false,
  onSend,
  actionText = 'Send',
  allowEmptyMessage = false,
  groupId,
  runId,
  scrollIntoView = null,
  scrollText = t('View'),
  isRootCauseSelectionStep = false,
  isChangesStep = false,
}: AutofixMessageBoxProps) {
  const [message, setMessage] = useState('');
  const {mutate: send} = useSendMessage({groupId, runId});
  const [height, setHeight] = useState<number | 'auto'>('auto');
  const contentRef = useRef<HTMLDivElement>(null);

  const [rootCauseMode, setRootCauseMode] = useState<
    'suggested_root_cause' | 'custom_root_cause'
  >('suggested_root_cause');

  const [changesMode, setChangesMode] = useState<
    'give_feedback' | 'add_tests' | 'create_prs'
  >('give_feedback');

  const changes =
    isChangesStep && step?.type === AutofixStepType.CHANGES ? step.changes : [];
  const prsMade =
    step?.status === 'COMPLETED' &&
    changes.length >= 1 &&
    changes.every(change => change.pull_request);

  const isDisabled =
    step?.status === 'ERROR' ||
    (step?.type === AutofixStepType.ROOT_CAUSE_ANALYSIS && step.causes?.length === 0);

  useEffect(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    }
  }, [displayText, step, isRootCauseSelectionStep, rootCauseMode]);

  const handleSend = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isRootCauseSelectionStep && onSend) {
      if (rootCauseMode === 'custom_root_cause' && message.trim() !== '') {
        onSend?.(message, true);
        setMessage('');
      } else if (rootCauseMode === 'suggested_root_cause') {
        onSend?.(message, false);
        setMessage('');
      }
      return;
    }

    let text = message;
    if (isChangesStep && changesMode === 'add_tests') {
      text =
        'Please write a unit test that reproduces the issue to make sure it is fixed.';
    }

    if (text.trim() !== '' || allowEmptyMessage) {
      if (onSend != null) {
        onSend(text);
      } else {
        send({
          message: text,
        });
      }
      setMessage('');
    }
  };

  return (
    <Container>
      <AnimatedContent animate={{height}} transition={{duration: 0.3, ease: 'easeInOut'}}>
        <ContentWrapper ref={contentRef}>
          <ContentArea>
            {step && (
              <StepHeader>
                <StepTitle
                  dangerouslySetInnerHTML={{
                    __html: singleLineRenderer(step.title),
                  }}
                />
                <StepHeaderRightSection>
                  {scrollIntoView !== null && (
                    <ScrollIntoViewButtonWrapper>
                      <AnimatePresence initial>
                        <motion.div key="content" {...animationProps}>
                          <Button
                            onClick={scrollIntoView}
                            size="xs"
                            priority="primary"
                            icon={<IconChevron direction="down" size="xs" />}
                            aria-label={t('Jump to content')}
                          >
                            {t('%s', scrollText)}
                          </Button>
                        </motion.div>
                      </AnimatePresence>
                    </ScrollIntoViewButtonWrapper>
                  )}
                  <StepIconContainer>
                    <StepIcon step={step} />
                  </StepIconContainer>
                </StepHeaderRightSection>
              </StepHeader>
            )}
            <Message
              dangerouslySetInnerHTML={{
                __html: singleLineRenderer(displayText),
              }}
            />
          </ContentArea>
          <ActionBar>
            {isRootCauseSelectionStep && (
              <Fragment>
                <SegmentedControl
                  size="xs"
                  value={rootCauseMode}
                  onChange={setRootCauseMode}
                  aria-label={t('Root cause selection')}
                >
                  <SegmentedControl.Item key="suggested_root_cause">
                    {t('Use suggested root cause')}
                  </SegmentedControl.Item>
                  <SegmentedControl.Item key="custom_root_cause">
                    {t('Propose your own root cause')}
                  </SegmentedControl.Item>
                </SegmentedControl>
              </Fragment>
            )}
            {isChangesStep && !prsMade && (
              <Fragment>
                <SegmentedControl
                  size="xs"
                  value={changesMode}
                  onChange={setChangesMode}
                  aria-label={t('Changes selection')}
                >
                  <SegmentedControl.Item key="give_feedback">
                    {t('Give feedback')}
                  </SegmentedControl.Item>
                  <SegmentedControl.Item key="add_tests">
                    {t('Add tests')}
                  </SegmentedControl.Item>
                  <SegmentedControl.Item key="create_prs">
                    {t('Approve changes')}
                  </SegmentedControl.Item>
                </SegmentedControl>
              </Fragment>
            )}
          </ActionBar>
        </ContentWrapper>
      </AnimatedContent>
      <InputSection>
        {(!isChangesStep || changesMode === 'give_feedback') &&
          !prsMade &&
          !isDisabled && (
            <form onSubmit={handleSend}>
              <InputArea>
                {!responseRequired ? (
                  <Fragment>
                    <NormalInput
                      type="text"
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      placeholder={
                        !isRootCauseSelectionStep
                          ? 'Say something...'
                          : rootCauseMode === 'suggested_root_cause'
                            ? '(Optional) Provide any instructions for the fix...'
                            : 'Propose your own root cause...'
                      }
                    />
                    <Button
                      type="submit"
                      priority={primaryAction ? 'primary' : 'default'}
                    >
                      {actionText}
                    </Button>
                  </Fragment>
                ) : (
                  <Fragment>
                    <RequiredInput
                      type="text"
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      placeholder={'Please answer to continue...'}
                    />
                    <Button type="submit" priority={'primary'}>
                      {actionText}
                    </Button>
                  </Fragment>
                )}
              </InputArea>
            </form>
          )}
        {isChangesStep && changesMode === 'add_tests' && !prsMade && (
          <form onSubmit={handleSend}>
            <InputArea>
              <Fragment>
                <StaticMessage>
                  Write unit tests to make sure the issue is fixed?
                </StaticMessage>
                <Button type="submit" priority="primary">
                  Add Tests
                </Button>
              </Fragment>
            </InputArea>
          </form>
        )}
        {isChangesStep && changesMode === 'create_prs' && !prsMade && (
          <InputArea>
            <Fragment>
              <StaticMessage>
                Draft {changes.length} pull request{changes.length > 1 ? 's' : ''} for the
                above changes?
              </StaticMessage>
              <SetupAndCreatePRsButton changes={changes} groupId={groupId} />
            </Fragment>
          </InputArea>
        )}
        {isChangesStep && prsMade && (
          <ViewPRButtons aria-label={t('View pull requests')}>
            {changes.map(
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
          </ViewPRButtons>
        )}
      </InputSection>
    </Container>
  );
}

const ViewPRButtons = styled(ScrollCarousel)`
  width: 100%;
  padding: 0 ${space(1)};
`;

const ScrollIntoViewButtonWrapper = styled('div')`
  position: absolute;
  top: -2rem;
  right: 50%;
  transform: translateX(50%);
`;

const Container = styled('div')`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: ${p => p.theme.backgroundElevated};
  z-index: 100;
  border-top: 1px solid ${p => p.theme.border};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  display: flex;
  flex-direction: column;
`;

const AnimatedContent = styled(motion.div)`
  overflow: hidden;
`;

const ContentWrapper = styled('div')`
  display: flex;
  flex-direction: column;
`;

const ContentArea = styled('div')`
  padding: ${space(3)} ${space(2)} ${space(1)} ${space(2)};
`;

const Message = styled('div')`
  padding: 0 ${space(1)} 0 ${space(1)};
`;

const StepTitle = styled('div')`
  font-weight: ${p => p.theme.fontWeightBold};
  white-space: nowrap;
  display: flex;
  align-items: center;
  flex-grow: 1;

  span {
    margin-right: ${space(1)};
  }
`;

const StepHeaderRightSection = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const StepIconContainer = styled('div')`
  display: flex;
  align-items: center;
`;

const StepHeader = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 ${space(1)} ${space(1)} ${space(1)};
  font-size: ${p => p.theme.fontSizeMedium};
  font-family: ${p => p.theme.text.family};
`;

const InputArea = styled('div')`
  display: flex;
`;

const StaticMessage = styled('p')`
  flex-grow: 1;
  margin-right: 8px;
  padding-top: ${space(1)};
  padding-left: ${space(1)};
  margin-bottom: 0;
  color: ${p => p.theme.subText};
  border-top: 1px solid ${p => p.theme.border};
`;

const NormalInput = styled(Input)`
  flex-grow: 1;
  margin-right: 8px;
`;

const RequiredInput = styled(Input)`
  flex-grow: 1;
  margin-right: 8px;
  border-color: ${p => p.theme.errorFocus};
  box-shadow: 0 0 0 1px ${p => p.theme.errorFocus};
`;

const ProcessingStatusIndicator = styled(LoadingIndicator)`
  && {
    margin: 0;
    height: 14px;
    width: 14px;
  }
`;

const ActionBar = styled('div')`
  padding-bottom: ${space(1)};
  padding-left: ${space(2)};
`;

const InputSection = styled('div')`
  padding: 0 ${space(2)} ${space(2)} ${space(2)};
`;

export default AutofixMessageBox;
