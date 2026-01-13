import {startTransition, useEffect, useRef, useState, type FormEvent} from 'react';
import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
import {TextArea} from 'sentry/components/core/textarea';
import {Tooltip} from 'sentry/components/core/tooltip';
import {AutofixProgressBar} from 'sentry/components/events/autofix/autofixProgressBar';
import {FlyingLinesEffect} from 'sentry/components/events/autofix/FlyingLinesEffect';
import {useUpdateInsightCard} from 'sentry/components/events/autofix/hooks/useUpdateInsightCard';
import type {AutofixData} from 'sentry/components/events/autofix/types';
import {AutofixStepType} from 'sentry/components/events/autofix/types';
import {makeAutofixQueryKey} from 'sentry/components/events/autofix/useAutofix';
import {useTypingAnimation} from 'sentry/components/events/autofix/useTypingAnimation';
import {getAutofixRunErrorMessage} from 'sentry/components/events/autofix/utils';
import {IconRefresh, IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {singleLineRenderer} from 'sentry/utils/marked/marked';
import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import testableTransition from 'sentry/utils/testableTransition';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

function StreamContentText({stream}: {stream: string}) {
  const [displayedText, setDisplayedText] = useState('');

  const accumulatedTextRef = useRef('');
  const previousStreamPropRef = useRef('');
  const currentIndexRef = useRef(0);

  // Animation for stream text
  useEffect(() => {
    const newText = stream;
    const previousStream = previousStreamPropRef.current;
    const separator = '\n\n==========\n\n';

    const currentSegmentDisplayed = displayedText.slice(
      accumulatedTextRef.current.length
    );
    const isReset =
      newText !== previousStream && !newText.startsWith(currentSegmentDisplayed);

    if (isReset) {
      if (displayedText === previousStream) {
        accumulatedTextRef.current = displayedText + separator;
        currentIndexRef.current = accumulatedTextRef.current.length;
      } else {
        const fullPreviousTextWithSeparator = previousStream + separator;
        startTransition(() => {
          setDisplayedText(fullPreviousTextWithSeparator);
        });
        accumulatedTextRef.current = fullPreviousTextWithSeparator;
        currentIndexRef.current = fullPreviousTextWithSeparator.length;
      }
    }

    previousStreamPropRef.current = newText;

    const combinedText = accumulatedTextRef.current + newText;

    if (currentIndexRef.current > combinedText.length) {
      currentIndexRef.current = combinedText.length;
      if (displayedText !== combinedText) {
        startTransition(() => {
          setDisplayedText(combinedText);
        });
      }
    }

    let intervalId: number | undefined;
    if (currentIndexRef.current < combinedText.length) {
      intervalId = window.setInterval(() => {
        if (currentIndexRef.current < combinedText.length) {
          startTransition(() => {
            setDisplayedText(combinedText.slice(0, currentIndexRef.current + 1));
          });
          currentIndexRef.current++;
        } else {
          window.clearInterval(intervalId);
          intervalId = undefined;
        }
      }, 1);
    }

    return () => {
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [stream, displayedText]);

  return <StreamContent>{displayedText}</StreamContent>;
}

interface Props {
  groupId: string;
  runId: string;
  stream: string;
  activeLog?: string;
  autofixData?: AutofixData;
  isProcessing?: boolean;
  responseRequired?: boolean;
}

interface ActiveLogDisplayProps {
  groupId: string;
  runId: string;
  activeLog?: string;
  autofixData?: AutofixData;
  isInitializingRun?: boolean;
  seerIconRef?: React.RefObject<HTMLDivElement | null>;
}

function ActiveLogDisplay({
  activeLog = '',
  isInitializingRun = false,
  seerIconRef,
  autofixData,
  groupId,
  runId,
}: ActiveLogDisplayProps) {
  const displayedActiveLog =
    useTypingAnimation({
      text: activeLog,
      speed: 200,
      enabled: !!activeLog,
    }) || '';

  // special case for errored step
  const errorMessage = getAutofixRunErrorMessage(autofixData);
  const erroredStep = autofixData?.steps?.find(step => step.status === 'ERROR');
  const erroredStepIndex = erroredStep?.index ?? 0;
  let retainInsightCardIndex: number | null = null;
  if (
    erroredStep &&
    erroredStep.type === AutofixStepType.DEFAULT &&
    Array.isArray((erroredStep as any).insights)
  ) {
    const insights = (erroredStep as any).insights;
    if (insights.length > 0) {
      retainInsightCardIndex = insights.length;
    }
  }

  const {mutate: refreshStep, isPending: isRefreshing} = useUpdateInsightCard({
    groupId,
    runId,
  });

  if (errorMessage) {
    return (
      <ActiveLogWrapper>
        <SeerIconContainer>
          <IconSeer animation="waiting" size="lg" />
        </SeerIconContainer>
        <ActiveLog>{errorMessage}</ActiveLog>
        <Button
          size="xs"
          borderless
          aria-label={t('Retry step')}
          title={t('Retry step')}
          onClick={() =>
            refreshStep({
              message: '',
              step_index: erroredStepIndex,
              retain_insight_card_index: retainInsightCardIndex,
            })
          }
          disabled={isRefreshing}
          style={{marginLeft: 'auto'}}
        >
          <IconRefresh size="sm" />
        </Button>
      </ActiveLogWrapper>
    );
  }
  if (activeLog) {
    return (
      <ActiveLogWrapper>
        <Tooltip
          title={t(
            "Seer is hard at work. Feel free to leave - it'll keep running in the background."
          )}
        >
          <SeerIconContainer ref={seerIconRef}>
            <StyledAnimatedSeerIcon animation="loading" size="lg" />
            {seerIconRef?.current && isInitializingRun && (
              <FlyingLinesEffect targetElement={seerIconRef.current} />
            )}
          </SeerIconContainer>
        </Tooltip>
        <ActiveLog
          dangerouslySetInnerHTML={{
            __html: singleLineRenderer(displayedActiveLog),
          }}
        />
      </ActiveLogWrapper>
    );
  }
  return null;
}

export function AutofixOutputStream({
  stream,
  activeLog = '',
  groupId,
  runId,
  autofixData,
  responseRequired = false,
}: Props) {
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();

  const [message, setMessage] = useState('');
  const seerIconRef = useRef<HTMLDivElement>(null);

  const isInitializingRun = activeLog === 'Ingesting Sentry data...';

  const orgSlug = useOrganization().slug;

  const {mutate: send} = useMutation({
    mutationFn: (params: {message: string}) => {
      return api.requestPromise(
        `/organizations/${orgSlug}/issues/${groupId}/autofix/update/`,
        {
          method: 'POST',
          data: {
            run_id: runId,
            payload: {
              type: 'user_message',
              text: params.message,
            },
          },
        }
      );
    },
    onSuccess: _ => {
      queryClient.invalidateQueries({
        queryKey: makeAutofixQueryKey(orgSlug, groupId, true),
      });
      queryClient.invalidateQueries({
        queryKey: makeAutofixQueryKey(orgSlug, groupId, false),
      });
      addSuccessMessage(t('Thanks for the input.'));
    },
    onError: () => {
      addErrorMessage(t('Something went wrong when sending Seer your message.'));
    },
  });

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    if (isInitializingRun) {
      // don't send message during loading state
      return;
    }
    if (message.trim() !== '') {
      send({message});
      setMessage('');
    }
  };

  return (
    <AnimatePresence mode="wait">
      <Wrapper
        key="output-stream"
        initial={{opacity: 0, height: 0}}
        animate={{opacity: 1, height: 'auto'}}
        exit={{opacity: 0, height: 0}}
        transition={testableTransition({
          duration: 0.2,
          height: {
            type: 'spring',
            bounce: 0.2,
          },
        })}
      >
        <ScaleContainer
          initial={{scaleY: 0.8}}
          animate={{scaleY: 1}}
          exit={{scaleY: 0.8}}
          transition={testableTransition({
            duration: 0.2,
            scaleY: {
              type: 'spring',
              bounce: 0.2,
            },
          })}
        >
          <VerticalLine />
          <Container required={responseRequired}>
            {getAutofixRunErrorMessage(autofixData) || activeLog ? (
              <ActiveLogDisplay
                activeLog={activeLog}
                isInitializingRun={isInitializingRun}
                seerIconRef={seerIconRef}
                autofixData={autofixData}
                groupId={groupId}
                runId={runId}
              />
            ) : null}
            {autofixData && (
              <ProgressBarWrapper>
                <AutofixProgressBar autofixData={autofixData} />
              </ProgressBarWrapper>
            )}
            {!responseRequired && stream && <StreamContentText stream={stream} />}
            <InputWrapper onSubmit={handleSend}>
              <StyledInput
                autosize
                value={message}
                onChange={e => setMessage(e.target.value)}
                maxLength={4096}
                placeholder={
                  responseRequired ? 'Please answer to continue...' : 'Add context...'
                }
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e);
                  }
                }}
                maxRows={5}
                size="sm"
              />
              <StyledButton
                type="submit"
                borderless
                aria-label={t('Submit Comment')}
                size="zero"
              >
                {'\u23CE'}
              </StyledButton>
            </InputWrapper>
          </Container>
        </ScaleContainer>
      </Wrapper>
    </AnimatePresence>
  );
}

const Wrapper = styled(motion.div)`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-bottom: ${space(1)};
  gap: ${space(1)};
`;

const ScaleContainer = styled(motion.div)`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  transform-origin: top left;
`;

const shimmer = keyframes`
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
`;

const Container = styled(motion.div)<{required: boolean}>`
  position: relative;
  width: 100%;
  background: ${p => p.theme.tokens.background.primary};
  border-radius: ${p => p.theme.radius.md};
  border: 1px dashed ${p => p.theme.tokens.border.primary};

  &:before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent,
      color-mix(
        in srgb,
        ${p =>
            p.required
              ? p.theme.colors.pink500
              : p.theme.tokens.interactive.link.accent.active}
          12.5%,
        transparent
      )
    );
    background-size: 2000px 100%;
    border-radius: ${p => p.theme.radius.md};
    animation: ${shimmer} 2s infinite linear;
    pointer-events: none;
  }
`;

const StreamContent = styled('div')`
  margin: 0;
  padding: ${space(2)};
  white-space: pre-wrap;
  word-break: break-word;
  color: ${p => p.theme.tokens.content.secondary};
  max-height: 35vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column-reverse;
`;

const ActiveLogWrapper = styled('div')`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: ${space(1)};
  background: ${p => p.theme.backgroundSecondary};
  gap: ${space(1)};
  overflow: visible;
`;

const ActiveLog = styled('div')`
  flex-grow: 1;
  word-break: break-word;
  margin-top: ${space(0.25)};
`;

const VerticalLine = styled('div')`
  width: 0;
  height: ${space(4)};
  border-left: 1px dashed ${p => p.theme.tokens.border.primary};
  margin-left: 33px;
  margin-bottom: -1px;
`;

const InputWrapper = styled('form')`
  display: flex;
  padding: ${space(0.5)};
  position: relative;
`;

const StyledInput = styled(TextArea)`
  flex-grow: 1;
  border-color: ${p => p.theme.tokens.border.secondary};
  padding-right: ${space(4)};
  resize: none;

  &:hover {
    border-color: ${p => p.theme.tokens.border.primary};
  }
`;

const StyledButton = styled(Button)`
  position: absolute;
  right: ${space(1)};
  top: 50%;
  transform: translateY(-50%);
  height: 24px;
  width: 24px;
  margin-right: 0;
  color: ${p => p.theme.tokens.content.secondary};
`;

const SeerIconContainer = styled('div')`
  position: relative;
  flex-shrink: 0;
`;

const StyledAnimatedSeerIcon = styled(IconSeer)`
  position: relative;
  transition: opacity 0.2s ease;
  top: 0;
  flex-shrink: 0;
  color: ${p => p.theme.tokens.content.primary};
  z-index: 10000;
`;

const ProgressBarWrapper = styled('div')`
  position: relative;
`;
