import React, {Fragment, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion, type MotionNodeAnimationOptions} from 'framer-motion';

import {addErrorMessage, addLoadingMessage} from 'sentry/actionCreators/indicator';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {TextArea} from 'sentry/components/core/textarea';
import {AutofixHighlightWrapper} from 'sentry/components/events/autofix/autofixHighlightWrapper';
import {
  type AutofixRootCauseData,
  type AutofixRootCauseSelection,
  type CommentThread,
} from 'sentry/components/events/autofix/types';
import {makeAutofixQueryKey} from 'sentry/components/events/autofix/useAutofix';
import {formatRootCauseWithEvent} from 'sentry/components/events/autofix/utils';
import {IconArrow, IconChat, IconClose, IconCopy, IconFocus} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import {singleLineRenderer} from 'sentry/utils/marked/marked';
import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import testableTransition from 'sentry/utils/testableTransition';
import useApi from 'sentry/utils/useApi';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import useOrganization from 'sentry/utils/useOrganization';

import AutofixHighlightPopup from './autofixHighlightPopup';
import {AutofixTimeline} from './autofixTimeline';

function useSelectRootCause({groupId, runId}: {groupId: string; runId: string}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const orgSlug = useOrganization().slug;

  return useMutation({
    mutationFn: (params: {cause_id: string; instruction?: string}) => {
      return api.requestPromise(
        `/organizations/${orgSlug}/issues/${groupId}/autofix/update/`,
        {
          method: 'POST',
          data: {
            run_id: runId,
            payload: {
              type: 'select_root_cause',
              cause_id: params.cause_id,
              instruction: params.instruction || null,
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
      addLoadingMessage(t('On it...'));
    },
    onError: () => {
      addErrorMessage(t('Something went wrong when selecting the root cause.'));
    },
  });
}

type AutofixRootCauseProps = {
  causes: AutofixRootCauseData[];
  groupId: string;
  rootCauseSelection: AutofixRootCauseSelection;
  runId: string;
  agentCommentThread?: CommentThread;
  event?: Event;
  isRootCauseFirstAppearance?: boolean;
  previousDefaultStepIndex?: number;
  previousInsightCount?: number;
  terminationReason?: string;
};

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

export function replaceHeadersWithBold(markdown: string) {
  const headerRegex = /^(#{1,6})\s+(.*)$/gm;
  const boldMarkdown = markdown.replace(headerRegex, (_match, _hashes, content) => {
    return ` **${content}** `;
  });

  return boldMarkdown;
}

function RootCauseDescription({
  cause,
  groupId,
  runId,
  previousDefaultStepIndex,
  previousInsightCount,
  ref,
}: {
  cause: AutofixRootCauseData;
  groupId: string;
  runId: string;
  previousDefaultStepIndex?: number;
  previousInsightCount?: number;
  ref?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <CauseDescription>
      {cause.description && (
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
          <Description
            dangerouslySetInnerHTML={{__html: singleLineRenderer(cause.description)}}
          />
        </AutofixHighlightWrapper>
      )}
      {cause.root_cause_reproduction && (
        <AutofixTimeline
          events={cause.root_cause_reproduction}
          eventCodeUrls={cause.reproduction_urls}
          groupId={groupId}
          runId={runId}
          stepIndex={previousDefaultStepIndex ?? 0}
          retainInsightCardIndex={
            previousInsightCount !== undefined && previousInsightCount >= 0
              ? previousInsightCount
              : null
          }
        />
      )}
    </CauseDescription>
  );
}

export function formatRootCauseText(
  cause: AutofixRootCauseData | undefined,
  customRootCause?: string
) {
  if (!cause && !customRootCause) {
    return '';
  }

  if (customRootCause) {
    return `# Root Cause of the Issue\n\n${customRootCause}`;
  }

  if (!cause) {
    return '';
  }

  const parts: string[] = ['# Root Cause of the Issue'];

  if (cause.description) {
    parts.push(cause.description);
  }

  if (cause.root_cause_reproduction) {
    parts.push(
      cause.root_cause_reproduction
        .map(event => {
          const eventParts = [`### ${event.title}`];

          if (event.code_snippet_and_analysis) {
            eventParts.push(event.code_snippet_and_analysis);
          }

          if (event.relevant_code_file) {
            eventParts.push(`(See @${event.relevant_code_file.file_path})`);
          }

          return eventParts.join('\n');
        })
        .join('\n\n')
    );
  }

  return parts.join('\n\n');
}

function CopyRootCauseButton({
  cause,
  customRootCause,
  event,
}: {
  cause?: AutofixRootCauseData;
  customRootCause?: string;
  event?: Event;
}) {
  const text = formatRootCauseWithEvent(cause, customRootCause, event);
  const {onClick, label} = useCopyToClipboard({
    text,
  });

  return (
    <Button
      size="sm"
      aria-label={label}
      title="Copy analysis as Markdown / LLM prompt"
      onClick={onClick}
      analyticsEventName="Autofix: Copy Root Cause as Markdown"
      analyticsEventKey="autofix.root_cause.copy"
      icon={<IconCopy />}
    >
      {t('Copy')}
    </Button>
  );
}

function AutofixRootCauseDisplay({
  causes,
  groupId,
  runId,
  rootCauseSelection,
  previousDefaultStepIndex,
  previousInsightCount,
  agentCommentThread,
  event,
}: AutofixRootCauseProps) {
  const cause = causes[0];
  const iconFocusRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLDivElement | null>(null);
  const [isProvidingSolution, setIsProvidingSolution] = useState(false);
  const [solutionText, setSolutionText] = useState('');
  const {mutate: selectRootCause, isPending: isSelectingRootCause} = useSelectRootCause({
    groupId,
    runId,
  });

  const handleSelectDescription = () => {
    if (descriptionRef.current) {
      // Simulate a click on the description to trigger the text selection
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      });
      descriptionRef.current.dispatchEvent(clickEvent);
    }
  };

  const handleSelectRootCause = () => {
    if (cause?.id !== undefined && cause.id !== null) {
      selectRootCause({
        cause_id: cause.id,
      });
    } else {
      addErrorMessage(t('No root cause available.'));
    }
  };

  const handleMySolution = () => {
    setIsProvidingSolution(true);
    setSolutionText('');
  };

  const handleCancelSolution = () => {
    setIsProvidingSolution(false);
    setSolutionText('');
  };

  const handleSubmitSolution = (e: React.FormEvent) => {
    e.preventDefault();
    if (!solutionText.trim()) {
      return;
    }

    if (cause?.id !== undefined && cause.id !== null) {
      selectRootCause({
        cause_id: cause.id,
        instruction: solutionText.trim(),
      });
      setIsProvidingSolution(false);
      setSolutionText('');
    } else {
      addErrorMessage(t('No root cause available.'));
    }
  };

  if (!cause) {
    return (
      <Alert.Container>
        <Alert type="error" showIcon={false}>
          {t('No root cause available.')}
        </Alert>
      </Alert.Container>
    );
  }

  if (rootCauseSelection && 'custom_root_cause' in rootCauseSelection) {
    return (
      <CausesContainer>
        <CustomRootCausePadding>
          <HeaderWrapper>
            <HeaderText>
              <IconWrapper ref={iconFocusRef}>
                <IconFocus size="md" color="pink400" />
              </IconWrapper>
              {t('Custom Root Cause')}
            </HeaderText>
          </HeaderWrapper>
          <CauseDescription>{rootCauseSelection.custom_root_cause}</CauseDescription>
          <BottomDivider />
          <BottomButtonContainer>
            <CopyRootCauseButton
              customRootCause={rootCauseSelection.custom_root_cause}
              event={event}
            />
          </BottomButtonContainer>
        </CustomRootCausePadding>
      </CausesContainer>
    );
  }

  return (
    <CausesContainer>
      <HeaderWrapper>
        <HeaderText>
          <IconWrapper ref={iconFocusRef}>
            <IconFocus size="md" color="pink400" />
          </IconWrapper>
          {t('Root Cause')}
          <Button
            size="zero"
            borderless
            title={t('Chat with Seer')}
            onClick={handleSelectDescription}
            analyticsEventName="Autofix: Root Cause Chat"
            analyticsEventKey="autofix.root_cause.chat"
          >
            <IconChat />
          </Button>
        </HeaderText>
      </HeaderWrapper>
      <AnimatePresence>
        {agentCommentThread && iconFocusRef.current && (
          <AutofixHighlightPopup
            selectedText=""
            referenceElement={iconFocusRef.current}
            groupId={groupId}
            runId={runId}
            stepIndex={previousDefaultStepIndex ?? 0}
            retainInsightCardIndex={
              previousInsightCount !== undefined && previousInsightCount >= 0
                ? previousInsightCount
                : null
            }
            isAgentComment
            blockName={t('Seer is uncertain of the root cause...')}
          />
        )}
      </AnimatePresence>
      <Content>
        <Fragment>
          <RootCauseDescription
            cause={cause}
            groupId={groupId}
            runId={runId}
            previousDefaultStepIndex={previousDefaultStepIndex}
            previousInsightCount={previousInsightCount}
            ref={descriptionRef}
          />
        </Fragment>
      </Content>
      <BottomDivider />
      <BottomButtonContainer>
        {isProvidingSolution ? (
          <SolutionInputContainer>
            <form onSubmit={handleSubmitSolution}>
              <SolutionFormRow>
                <SolutionInput
                  autosize
                  value={solutionText}
                  maxLength={4096}
                  onChange={e => setSolutionText(e.target.value)}
                  placeholder={t('Provide a solution for Seer to follow...')}
                  autoFocus
                  maxRows={5}
                  size="sm"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmitSolution(e);
                    } else if (e.key === 'Escape') {
                      handleCancelSolution();
                    }
                  }}
                />
                <ButtonBar merged gap="0">
                  <Button type="button" size="sm" onClick={handleCancelSolution}>
                    <IconClose size="sm" />
                  </Button>
                  <Button
                    type="submit"
                    priority="primary"
                    size="sm"
                    busy={isSelectingRootCause}
                    disabled={!solutionText.trim()}
                  >
                    <IconArrow direction="right" />
                  </Button>
                </ButtonBar>
              </SolutionFormRow>
            </form>
          </SolutionInputContainer>
        ) : (
          <ButtonBar>
            <CopyRootCauseButton cause={cause} event={event} />
            <Button
              size="sm"
              onClick={handleMySolution}
              title={t('Specify your own solution for Seer to follow')}
            >
              {t('Give Solution')}
            </Button>
            <Button
              size="sm"
              priority={
                rootCauseSelection && 'cause_id' in rootCauseSelection
                  ? 'default'
                  : 'primary'
              }
              busy={isSelectingRootCause}
              onClick={handleSelectRootCause}
              title={t('Let Seer plan a solution to this issue')}
            >
              {t('Find Solution')}
            </Button>
          </ButtonBar>
        )}
      </BottomButtonContainer>
    </CausesContainer>
  );
}

export function AutofixRootCause(props: AutofixRootCauseProps) {
  if (props.causes.length === 0) {
    return (
      <AnimatePresence initial={props.isRootCauseFirstAppearance}>
        <AnimationWrapper key="card" {...cardAnimationProps}>
          <NoCausesPadding>
            <Alert.Container>
              <Alert type="warning" showIcon={false}>
                {t('No root cause found.\n\n%s', props.terminationReason ?? '')}
              </Alert>
            </Alert.Container>
          </NoCausesPadding>
        </AnimationWrapper>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence initial={props.isRootCauseFirstAppearance}>
      <AnimationWrapper key="card" {...cardAnimationProps}>
        <AutofixRootCauseDisplay {...props} />
      </AnimationWrapper>
    </AnimatePresence>
  );
}

const Description = styled('div')`
  border-bottom: 1px solid ${p => p.theme.innerBorder};
  padding-bottom: ${space(2)};
  margin-bottom: ${space(2)};
`;

const NoCausesPadding = styled('div')`
  padding: 0 ${space(2)};
`;

const CausesContainer = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
  box-shadow: ${p => p.theme.dropShadowMedium};
  padding: ${p => p.theme.space.lg};
`;

const Content = styled('div')`
  padding: ${space(1)} 0;
`;

const HeaderWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${space(1)};
  flex-wrap: wrap;
`;

const IconWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const HeaderText = styled('div')`
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: ${p => p.theme.fontSize.lg};
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const CustomRootCausePadding = styled('div')`
  padding: ${space(1)} ${space(0.25)} ${space(2)} ${space(0.25)};
`;

const CauseDescription = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  margin-top: ${space(0.5)};
`;

const AnimationWrapper = styled(motion.div)`
  transform-origin: top center;
`;

const BottomDivider = styled('div')`
  border-top: 1px solid ${p => p.theme.innerBorder};
`;

const BottomButtonContainer = styled('div')`
  display: flex;
  justify-content: flex-end;
  padding-top: ${p => p.theme.space.xl};
`;

const SolutionInputContainer = styled('div')`
  width: 100%;
  background: ${p => p.theme.background};
  border-radius: ${p => p.theme.borderRadius};
`;

const SolutionFormRow = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
  width: 100%;
`;

const SolutionInput = styled(TextArea)`
  flex: 1;
  resize: none;
`;
