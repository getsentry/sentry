import {Fragment, useEffect, useRef} from 'react';
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
import {Container, Grid, Stack, Surface} from '@sentry/scraps/layout';
import {streamingAnimationStyles, useTextDecodeAnimation} from '@sentry/scraps/markdown';
import {Text} from '@sentry/scraps/text';
import {useMedia} from '@sentry/scraps/useMedia';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t, tct} from 'sentry/locale';
import type {ChatSuggestionsState} from 'sentry/views/seerExplorer/hooks/useChatSuggestions';
import type {ChatSuggestion, SeerExplorerRunId} from 'sentry/views/seerExplorer/types';

const SUGGESTION_PLACEHOLDER_COUNT = 3;

interface EmptyStateProps {
  displaySlackAgentReminder?: boolean;
  errorStatusCode?: number | null;
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

    function handlePointerMove(event: PointerEvent) {
      const character = characterRef.current;
      if (!character || reducedMotion.matches || event.pointerType === 'touch') {
        return;
      }
      const {x, y} = getPupilOffset(character.getBoundingClientRect(), event);
      character.style.setProperty('--pupil-x', `${x}px`);
      character.style.setProperty('--pupil-y', `${y}px`);
    }

    function resetPupil() {
      characterRef.current?.style.setProperty('--pupil-x', '0px');
      characterRef.current?.style.setProperty('--pupil-y', '0px');
    }

    document.addEventListener('pointermove', handlePointerMove, {passive: true});
    document.addEventListener('pointerleave', resetPupil);
    window.addEventListener('blur', resetPupil);
    reducedMotion.addEventListener('change', resetPupil);
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerleave', resetPupil);
      window.removeEventListener('blur', resetPupil);
      reducedMotion.removeEventListener('change', resetPupil);
    };
  }, [isError, isLoading]);

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
                        onClick={(selected, position, card) => {
                          const character = characterRef.current;
                          if (character) {
                            slurpSuggestion(card, character);
                          }
                          onSuggestionClick(selected, position);
                        }}
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
        <Container padding="0 xl">
          <Alert variant="muted">
            {tct('Want to chat in Slack? Just ask [mention] to debug issues.', {
              mention: (
                <Text monospace variant="promotion">
                  @sentry
                </Text>
              ),
            })}
          </Alert>
        </Container>
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

function SuggestionItem({
  suggestion,
  position,
  onClick,
}: {
  onClick: (suggestion: ChatSuggestion, position: number, card: HTMLElement) => void;
  position: number;
  suggestion: ChatSuggestion | undefined;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useMedia('(prefers-reduced-motion: reduce)');
  const text = suggestion?.text;
  useTextDecodeAnimation(textRef, text, {pending: text === undefined});

  useEffect(() => {
    const card = cardRef.current;
    if (reducedMotion || !card?.animate) {
      return;
    }
    const animation = card.animate(
      [
        {transform: 'translateX(24px)', opacity: 0},
        {transform: 'translateX(0)', opacity: 1},
      ],
      {duration: 260, delay: position * 80, easing: 'ease-out', fill: 'backwards'}
    );
    return () => animation.cancel();
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- Replay the entrance when a page's prompt text changes.
  }, [text, position, reducedMotion]);

  return (
    <Surface
      ref={cardRef}
      data-suggestion-card=""
      variant="overlay"
      elevation="medium"
      radius="lg"
    >
      <SuggestionCard
        variant="transparent"
        size="zero"
        disabled={!suggestion}
        aria-label={text}
        onClick={() => {
          const card = cardRef.current;
          if (suggestion && card) {
            onClick(suggestion, position, card);
          }
        }}
      >
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
      </SuggestionCard>
    </Surface>
  );
}

function slurpSuggestion(card: HTMLElement, character: HTMLElement) {
  if (!card.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }
  const clone = card.cloneNode(true);
  const artwork = character.cloneNode(true);
  if (!(clone instanceof HTMLElement) || !(artwork instanceof HTMLElement)) {
    return;
  }
  const bounds = card.getBoundingClientRect();
  const target = character.getBoundingClientRect();
  for (const visual of [artwork, clone]) {
    visual.setAttribute('aria-hidden', 'true');
    visual.setAttribute('inert', '');
    Object.assign(visual.style, {
      position: 'fixed',
      pointerEvents: 'none',
      zIndex: '2147483647',
    });
  }
  artwork.setAttribute('data-seer-slurp', '');
  Object.assign(artwork.style, {
    left: `${target.left}px`,
    top: `${target.top}px`,
    width: `${target.width}px`,
    height: `${target.height}px`,
    animation: 'none',
    transform: 'none',
  });
  clone.removeAttribute('data-suggestion-card');
  clone.setAttribute('data-suggestion-slurp', '');
  Object.assign(clone.style, {
    left: `${bounds.left}px`,
    top: `${bounds.top}px`,
    width: `${bounds.width}px`,
    height: `${bounds.height}px`,
  });
  // Keep the visual transition alive after sending unmounts the empty state.
  document.body.append(artwork, clone);
  artwork.animate([{opacity: 1}, {opacity: 0}], {
    delay: 200,
    duration: 120,
    fill: 'forwards',
  });
  const x = target.left + target.width * 0.506 - bounds.left - bounds.width / 2;
  const y = target.top + target.height * 0.21 - bounds.top - bounds.height / 2;
  const animation = clone.animate(
    [
      {transform: 'translate(0, 0) scale(1)', opacity: 1},
      {transform: `translate(${x}px, ${y}px) scale(0.08)`, opacity: 0},
    ],
    {duration: 320, easing: 'cubic-bezier(0.55, 0.04, 0.95, 0.45)', fill: 'forwards'}
  );
  const cleanup = () => {
    clone.remove();
    artwork.remove();
  };
  void animation.finished.then(cleanup, cleanup);
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

const SuggestionContent = styled(Stack)`
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

const SuggestionCard = styled(Button)`
  width: 100%;
  min-height: 64px;
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
  font-weight: ${p => p.theme.font.weight.sans.regular};
  border-radius: ${p => p.theme.radius.lg};
`;
