import {Fragment, useEffect, useRef} from 'react';
import type {RefObject} from 'react';
import {Global, keyframes} from '@emotion/react';
import styled from '@emotion/styled';
import {IconSeer} from '@sentry/icons/seer';

import seerArmLeft from 'sentry-images/spot/seer-arm-left.svg';
import seerArmRight from 'sentry-images/spot/seer-arm-right.svg';
import seerBeam from 'sentry-images/spot/seer-beam.svg';
import seerCharacter from 'sentry-images/spot/seer-character.svg';
import seerEye from 'sentry-images/spot/seer-eye.svg';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Image} from '@sentry/scraps/image';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {streamingAnimationStyles, useTextDecodeAnimation} from '@sentry/scraps/markdown';
import {Text} from '@sentry/scraps/text';
import {ToggleCard} from '@sentry/scraps/toggleCard';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t, tct} from 'sentry/locale';
import type {ChatSuggestionsState} from 'sentry/views/seerExplorer/hooks/useChatSuggestions';
import type {ChatSuggestion, SeerExplorerRunId} from 'sentry/views/seerExplorer/types';

const SUGGESTION_PLACEHOLDER_COUNT = 3;

interface EmptyStateProps {
  composerRef?: RefObject<HTMLDivElement | null>;
  displaySlackAgentReminder?: boolean;
  errorStatusCode?: number | null;
  hasDraft?: boolean;
  /** The conversation could not be loaded: the request failed, or it came back errored. */
  isError?: boolean;
  isLoading?: boolean;
  /** Resets to a fresh session. Rendered as the recovery action on error states. */
  onStartNewChat?: () => void;
  onSuggestionClick?: (suggestion: ChatSuggestion, position: number) => void;
  runId?: SeerExplorerRunId | null;
  suggestions?: ChatSuggestionsState;
}

export function EmptyState({
  isLoading = false,
  isError = false,
  errorStatusCode = null,
  displaySlackAgentReminder = false,
  runId,
  onStartNewChat,
  onSuggestionClick,
  suggestions,
  composerRef,
  hasDraft = false,
}: EmptyStateProps) {
  const characterRef = useRef<HTMLDivElement>(null);
  const suggestionCount = suggestions?.isLoading
    ? SUGGESTION_PLACEHOLDER_COUNT
    : (suggestions?.suggestions.length ?? 0);
  const runIdDisplay = runId?.toString() ?? 'null';

  useEffect(() => {
    if (isError || isLoading) {
      return;
    }
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let pointer: Pick<PointerEvent, 'clientX' | 'clientY'> | null = null;

    function handlePointerMove(event: PointerEvent) {
      if (event.pointerType === 'touch') {
        return;
      }
      pointer = {clientX: event.clientX, clientY: event.clientY};
      updateGaze();
    }

    function updateGaze() {
      const character = characterRef.current;
      if (!character) {
        return;
      }
      if (reducedMotion.matches) {
        resetPupil();
        return;
      }
      const target = getComposerCaretPoint(composerRef?.current ?? null) ?? pointer;
      if (!target) {
        resetPupil();
        return;
      }
      const {x, y} = getPupilOffset(character.getBoundingClientRect(), target);
      character.style.setProperty('--pupil-x', `${x}px`);
      character.style.setProperty('--pupil-y', `${y}px`);
    }

    function resetPupil() {
      characterRef.current?.style.setProperty('--pupil-x', '0px');
      characterRef.current?.style.setProperty('--pupil-y', '0px');
    }

    function handlePointerLeave() {
      pointer = null;
      updateGaze();
    }

    document.addEventListener('pointermove', handlePointerMove, {passive: true});
    const caretEvents = [
      'selectionchange',
      'focusin',
      'focusout',
      'input',
      'keyup',
      'scroll',
    ];
    for (const event of caretEvents) {
      document.addEventListener(event, updateGaze, true);
    }
    document.addEventListener('pointerleave', handlePointerLeave);
    window.addEventListener('blur', resetPupil);
    window.addEventListener('resize', updateGaze);
    reducedMotion.addEventListener('change', updateGaze);
    updateGaze();
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      for (const event of caretEvents) {
        document.removeEventListener(event, updateGaze, true);
      }
      document.removeEventListener('pointerleave', handlePointerLeave);
      window.removeEventListener('blur', resetPupil);
      window.removeEventListener('resize', updateGaze);
      reducedMotion.removeEventListener('change', updateGaze);
    };
  }, [isError, isLoading, composerRef]);

  return (
    <Fragment>
      <Global styles={streamingAnimationStyles} />
      <Stack
        flex="1"
        align="center"
        justify="center"
        padding={{zero: 'xl', '2xs': '3xl'}}
      >
        {isError ? (
          // Checked before `isLoading`: a failed load can still be polling with
          // backoff, and a spinner there would sit next to a disabled composer
          // with no way out.
          <Fragment>
            <IconSeer size="xl" />
            <Container marginTop="xl" maxWidth="300px">
              <Text as="div" align="center" variant="secondary" density="comfortable">
                {errorStatusCode === 404
                  ? tct('Session not found (run_id=[runIdDisplay]).', {
                      runIdDisplay,
                    })
                  : t('There was a problem loading the conversation.')}
              </Text>
            </Container>
            {onStartNewChat && (
              // The composer is disabled on this screen: sending would post into the
              // run that just failed rather than open a fresh one, so this is the way out.
              <Container marginTop="xl" maxWidth="300px">
                <Text as="div" align="center" variant="secondary" density="comfortable">
                  <Button variant="link" size="zero" onClick={onStartNewChat}>
                    {t('Start a new chat')}
                  </Button>
                </Text>
              </Container>
            )}
          </Fragment>
        ) : isLoading ? (
          <Fragment>
            <LoadingIndicator size={32} />
            <Container marginTop="xl" maxWidth="300px">
              <Text as="div" align="center" variant="secondary" density="comfortable">
                {t('Ask Seer anything about your application.')}
              </Text>
            </Container>
          </Fragment>
        ) : (
          <Grid position="relative" width="100%" maxWidth="360px" columns="1fr">
            <FloatingCharacter
              ref={characterRef}
              area="1 / 1"
              alignSelf="start"
              position="relative"
              pointerEvents="none"
              aria-hidden
            >
              <Arm position="absolute" inset="0" $side="left">
                <Image src={seerArmLeft} alt="" loading="eager" />
              </Arm>
              <Arm position="absolute" inset="0" $side="right">
                <Image src={seerArmRight} alt="" loading="eager" />
              </Arm>
              <EyeSocket position="absolute" inset="0">
                <Pupil
                  position="absolute"
                  left="44.03%"
                  top="16.91%"
                  width="13.17%"
                  radius="full"
                />
              </EyeSocket>
              <Face position="relative">
                <Image src={seerCharacter} alt="" loading="eager" />
              </Face>
              <Beam position="absolute" inset="0">
                <Image src={seerBeam} alt="" loading="eager" />
              </Beam>
              <BeamScan data-beam-scan="" position="absolute" inset="0" />
            </FloatingCharacter>
            <SuggestionContent
              $hidden={hasDraft}
              aria-hidden={hasDraft || undefined}
              inert={hasDraft}
              area="1 / 1"
              position="relative"
              alignSelf="start"
              align="center"
              gap="lg"
              paddingBottom="lg"
            >
              <Container width="100%">
                <BeamCaption
                  as="div"
                  align="center"
                  variant="secondary"
                  density="comfortable"
                >
                  {t('Ask Seer anything about your application.')}
                </BeamCaption>
              </Container>
              {onSuggestionClick && suggestions && (
                <Stack
                  width="100%"
                  gap="md"
                  role="group"
                  aria-label={t('Suggested questions')}
                  aria-hidden={suggestions.isLoading || undefined}
                >
                  {Array.from({length: suggestionCount}, (_, index) => {
                    const suggestion = suggestions.isLoading
                      ? undefined
                      : suggestions.suggestions[index];
                    return (
                      <SuggestionItem
                        key={index}
                        suggestion={suggestion}
                        position={index}
                        onClick={onSuggestionClick}
                      />
                    );
                  })}
                </Stack>
              )}
            </SuggestionContent>
          </Grid>
        )}
      </Stack>
      {!isLoading && !isError && displaySlackAgentReminder && (
        <DraftExtras
          padding="0 xl"
          $hidden={hasDraft}
          aria-hidden={hasDraft || undefined}
          inert={hasDraft}
        >
          <Alert variant="muted">
            {tct('Want to chat in Slack? Just ask [mention] to debug issues.', {
              mention: (
                <Text monospace variant="promotion">
                  @sentry
                </Text>
              ),
            })}
          </Alert>
        </DraftExtras>
      )}
    </Fragment>
  );
}

export function getPupilOffset(
  bounds: Pick<DOMRect, 'x' | 'y' | 'width' | 'height'>,
  pointer: Pick<PointerEvent, 'clientX' | 'clientY'>
) {
  return {
    x: Math.max(
      -3,
      Math.min(3, (pointer.clientX - bounds.x - bounds.width * 0.506) / 50)
    ),
    y: Math.max(
      -2,
      Math.min(2, (pointer.clientY - bounds.y - bounds.height * 0.184) / 75)
    ),
  };
}

function getComposerCaretPoint(editor: HTMLDivElement | null) {
  if (!editor) {
    return null;
  }
  if (editor.ownerDocument.activeElement !== editor) {
    return null;
  }
  const selection = editor.ownerDocument.getSelection();
  if (selection?.focusNode && editor.contains(selection.focusNode)) {
    const range = editor.ownerDocument.createRange();
    range.setStart(selection.focusNode, selection.focusOffset);
    range.collapse(true);
    const rect = range.getBoundingClientRect?.();
    if (rect?.height) {
      return {clientX: rect.left, clientY: rect.top + rect.height / 2};
    }
  }
  const bounds = editor.getBoundingClientRect();
  const style = getComputedStyle(editor);
  return {
    clientX: bounds.left + (parseFloat(style.paddingLeft) || 0),
    clientY:
      bounds.top +
      (parseFloat(style.paddingTop) || 0) +
      (parseFloat(style.lineHeight) || parseFloat(style.fontSize) || 0) / 2,
  };
}

function SuggestionItem({
  suggestion,
  position,
  onClick,
}: {
  onClick: (suggestion: ChatSuggestion, position: number) => void;
  position: number;
  suggestion: ChatSuggestion | undefined;
}) {
  const textRef = useRef<HTMLDivElement>(null);
  const text = suggestion?.text;
  useTextDecodeAnimation(textRef, text, {
    pending: text === undefined,
    delay: position * 80,
  });

  return (
    <ToggleCard
      data-suggestion-card=""
      variant="button"
      padding="md lg"
      disabled={!suggestion}
      tabIndex={suggestion ? undefined : -1}
      aria-label={text}
      onClick={() => {
        if (suggestion) {
          onClick(suggestion, position);
        }
      }}
    >
      <Flex align="center" justify="center" minHeight="48px">
        <Text
          key={text ?? 'pending'}
          ref={textRef}
          as="div"
          size="sm"
          align="center"
          density="comfortable"
          wrap="normal"
          textWrap="pretty"
        >
          {text ?? t('Preparing your suggested questions…')}
        </Text>
      </Flex>
    </ToggleCard>
  );
}

const float = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
`;

const armDrift = keyframes`
  0%, 100% { transform: rotate(0); }
  50% { transform: rotate(var(--arm-tilt)) translateY(1px); }
`;

const scan = keyframes`
  0% { transform: translateY(450%); opacity: 0; }
  15% { opacity: 0.2; }
  80% { opacity: 0.45; }
  100% { transform: translateY(-50%); opacity: 0; }
`;

const DraftExtras = styled(Stack)<{$hidden: boolean}>`
  opacity: ${p => (p.$hidden ? 0 : 1)};
  visibility: ${p => (p.$hidden ? 'hidden' : 'visible')};
  transition:
    opacity 180ms ease-out,
    visibility 0s linear ${p => (p.$hidden ? '180ms' : '0s')};

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const SuggestionContent = styled(DraftExtras)`
  padding-top: calc(237.4 / 170.58 * 43%);
`;

const Arm = styled(Container)<{$side: 'left' | 'right'}>`
  z-index: 0;
  transform-origin: ${p => (p.$side === 'left' ? '39% 27%' : '62% 27%')};
  --arm-tilt: ${p => (p.$side === 'left' ? '1.5deg' : '-1.5deg')};

  @media (prefers-reduced-motion: no-preference) {
    animation: ${armDrift} ${p => (p.$side === 'left' ? '5.2s' : '4.6s')} ease-in-out
      infinite;
    animation-delay: ${p => (p.$side === 'left' ? '-1s' : '-2.4s')};
  }
`;

const FloatingCharacter = styled(Container)`
  isolation: isolate;

  @media (prefers-reduced-motion: no-preference) {
    animation: ${float} 6s ease-in-out infinite;
  }
`;

const EyeSocket = styled(Container)`
  z-index: 1;
  background: #fff;
  mask: url('${seerEye}') center / 100% 100% no-repeat;
`;

const Face = styled(Container)`
  z-index: 2;
`;

const Beam = styled(Container)`
  z-index: 3;
`;

const BeamCaption = styled(Text)`
  mix-blend-mode: luminosity;
`;

const Pupil = styled(Container)`
  aspect-ratio: 1;
  background: #181225;
  border: 1px solid #000;

  @media (prefers-reduced-motion: no-preference) {
    transform: translate(var(--pupil-x, 0px), var(--pupil-y, 0px));
    transition: transform 150ms ease-out;
  }
`;

const BeamScan = styled(Container)`
  z-index: 4;
  mask: url('${seerBeam}') center / 100% 100% no-repeat;

  &::after {
    content: '';
    display: block;
    position: absolute;
    top: 21%;
    width: 100%;
    height: 16%;
    opacity: 0;
    background: linear-gradient(
      transparent,
      rgb(158 229 76 / 12%) 40%,
      rgb(231 255 223 / 65%) 50%,
      rgb(158 229 76 / 12%) 60%,
      transparent
    );

    @media (prefers-reduced-motion: no-preference) {
      animation: ${scan} 6s ease-in-out infinite;
    }
  }
`;
