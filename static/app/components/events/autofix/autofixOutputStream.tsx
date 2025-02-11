import {type FormEvent, useEffect, useRef, useState} from 'react';
import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import {makeAutofixQueryKey} from 'sentry/components/events/autofix/useAutofix';
import Input from 'sentry/components/input';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {singleLineRenderer} from 'sentry/utils/marked';
import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import testableTransition from 'sentry/utils/testableTransition';
import useApi from 'sentry/utils/useApi';

interface Props {
  groupId: string;
  runId: string;
  stream: string;
  activeLog?: string;
  isProcessing?: boolean;
  responseRequired?: boolean;
}

const shimmer = keyframes`
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
`;

export function AutofixOutputStream({
  stream,
  activeLog = '',
  groupId,
  runId,
  responseRequired = false,
  isProcessing = false,
}: Props) {
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();

  const [displayedText, setDisplayedText] = useState('');
  const [displayedActiveLog, setDisplayedActiveLog] = useState('');
  const [message, setMessage] = useState('');

  const previousText = useRef('');
  const previousActiveLog = useRef('');
  const currentIndexRef = useRef(0);
  const activeLogIndexRef = useRef(0);

  const {mutate: send} = useMutation({
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
      queryClient.invalidateQueries({queryKey: makeAutofixQueryKey(groupId)});
      addSuccessMessage('Thanks for the input.');
    },
    onError: () => {
      addErrorMessage(t('Something went wrong when sending Autofix your message.'));
    },
  });

  // Animation for stream text
  useEffect(() => {
    const newText = stream;

    if (!newText.startsWith(displayedText)) {
      previousText.current = newText;
      currentIndexRef.current = 0;
      setDisplayedText('');
    }

    const interval = window.setInterval(() => {
      if (currentIndexRef.current < newText.length) {
        setDisplayedText(newText.slice(0, currentIndexRef.current + 1));
        currentIndexRef.current++;
      } else {
        window.clearInterval(interval);
      }
    }, 5);

    return () => {
      window.clearInterval(interval);
    };
  }, [displayedText, stream]);

  // Animation for active log
  useEffect(() => {
    const newActiveLog = activeLog;

    if (!newActiveLog.startsWith(displayedActiveLog)) {
      previousActiveLog.current = newActiveLog;
      activeLogIndexRef.current = 0;
      setDisplayedActiveLog('');
    }

    const interval = window.setInterval(() => {
      if (activeLogIndexRef.current < newActiveLog.length) {
        setDisplayedActiveLog(newActiveLog.slice(0, activeLogIndexRef.current + 1));
        activeLogIndexRef.current++;
      } else {
        window.clearInterval(interval);
      }
    }, 15);

    return () => {
      window.clearInterval(interval);
    };
  }, [displayedActiveLog, activeLog]);

  const handleSend = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
          <Container layout required={responseRequired}>
            {activeLog && (
              <ActiveLogWrapper>
                <ActiveLog
                  dangerouslySetInnerHTML={{
                    __html: singleLineRenderer(displayedActiveLog),
                  }}
                />
                {isProcessing && <StyledLoadingIndicator mini size={14} />}
              </ActiveLogWrapper>
            )}
            {!responseRequired && stream && (
              <StreamContent>{displayedText}</StreamContent>
            )}
            <InputWrapper onSubmit={handleSend}>
              <StyledInput
                type="text"
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder={
                  responseRequired ? 'Please answer to continue...' : 'Interrupt me...'
                }
                required={responseRequired}
              />
              <StyledButton
                type="submit"
                borderless
                aria-label={t('Submit Comment')}
                size="zero"
              >
                <IconChevron direction="right" />
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
  margin-right: ${space(2)};
  gap: ${space(1)};
  overflow: hidden;
`;

const ScaleContainer = styled(motion.div)`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  transform-origin: top left;
  padding-left: ${space(2)};
`;

const Container = styled(motion.div)<{required: boolean}>`
  position: relative;
  width: 100%;
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.theme.background};
  border: 1px dashed ${p => p.theme.border};
  overflow: hidden;

  &:before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent,
      ${p => (p.required ? p.theme.pink400 : p.theme.active)}20,
      transparent
    );
    background-size: 2000px 100%;
    animation: ${shimmer} 2s infinite linear;
    pointer-events: none;
  }
`;

const StreamContent = styled('div')`
  margin: 0;
  padding: ${space(2)};
  white-space: pre-wrap;
  word-break: break-word;
  color: ${p => p.theme.subText};
  height: 7rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column-reverse;
`;

const ActiveLogWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${space(1)};
  padding-right: 0;
  padding-left: ${space(2)};
  background: ${p => p.theme.backgroundSecondary};
  gap: ${space(1)};
`;

const ActiveLog = styled('div')`
  flex-grow: 1;
  word-break: break-word;
`;

const VerticalLine = styled('div')`
  width: 0;
  height: ${space(4)};
  border-left: 2px dashed ${p => p.theme.subText};
  margin-left: 17px;
  margin-bottom: -1px;
`;

const InputWrapper = styled('form')`
  display: flex;
  padding: ${space(0.5)};
  position: relative;
`;

const StyledInput = styled(Input)`
  flex-grow: 1;
  background: ${p => p.theme.background}
    linear-gradient(to left, ${p => p.theme.background}, ${p => p.theme.pink400}20);
  border-color: ${p => p.theme.innerBorder};
  padding-right: ${space(4)};

  &:hover {
    border-color: ${p => p.theme.border};
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
  z-index: 2;
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  position: relative;
  top: ${space(0.5)};
`;
