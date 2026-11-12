import {Fragment, useEffect, useRef} from 'react';
import {keyframes, useTheme} from '@emotion/react';
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
import {Container, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Placeholder} from 'sentry/components/placeholder';
import {t, tct} from 'sentry/locale';
import type {ChatSuggestionsState} from 'sentry/views/seerExplorer/hooks/useChatSuggestions';
import type {ChatSuggestion, SeerExplorerRunId} from 'sentry/views/seerExplorer/types';

const SUGGESTION_PLACEHOLDER_WIDTHS = ['90%', '100%', '65%'];

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
  const theme = useTheme();
  const characterRef = useRef<HTMLDivElement>(null);
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
          <Container position="relative" width="100%" maxWidth="360px">
            <FloatingCharacter
              ref={characterRef}
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
              <BeamScan position="absolute" top="21%" bottom="0" left="0" right="0" />
            </FloatingCharacter>
            <Stack position="absolute" top="43%" left="0" right="0" align="center">
              <Container width="100%">
                <Text as="div" align="center" variant="secondary" density="comfortable">
                  {t('Ask Seer anything about your application.')}
                </Text>
              </Container>
              {onSuggestionClick && suggestions && (
                <Stack
                  align="center"
                  width="100%"
                  gap="md"
                  paddingTop="2xl"
                  aria-hidden={suggestions.isLoading || undefined}
                >
                  {suggestions.isLoading
                    ? SUGGESTION_PLACEHOLDER_WIDTHS.map(width => (
                        <SuggestionPlaceholder
                          key={width}
                          width={width}
                          height={theme.form.sm.height}
                          testId="suggestion-placeholder"
                        />
                      ))
                    : suggestions.suggestions.map((suggestion, index) => (
                        <Container key={index} maxWidth="100%">
                          <SuggestionButton
                            size="sm"
                            onClick={() => onSuggestionClick(suggestion, index)}
                          >
                            {suggestion.text}
                          </SuggestionButton>
                        </Container>
                      ))}
                </Stack>
              )}
            </Stack>
          </Container>
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

const float = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
`;

const scan = keyframes`
  0% { transform: translateY(-100%); opacity: 0; }
  20% { opacity: 0.25; }
  45% { opacity: 0.55; }
  70% { opacity: 0.25; }
  100% { transform: translateY(500%); opacity: 0; }
`;

const pulse = keyframes`
  0%, 100% { opacity: 0.45; }
  50% { opacity: 0.8; }
`;

const armDrift = keyframes`
  0%, 100% { transform: rotate(0); }
  50% { transform: rotate(var(--arm-tilt)) translateY(1px); }
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
  clip-path: polygon(41% 0, 60% 0, 95% 100%, 8% 100%);

  &::after {
    content: '';
    display: block;
    height: 20%;
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

const SuggestionPlaceholder = styled(Placeholder)`
  border: 1px solid ${p => p.theme.tokens.border.primary};
  opacity: 0.6;

  @media (prefers-reduced-motion: no-preference) {
    animation: ${pulse} 1.8s ease-in-out infinite;
  }
`;

const SuggestionButton = styled(Button)`
  width: 100%;
  height: auto;
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.md};
  font-size: ${p => p.theme.font.size.sm};
  font-weight: ${p => p.theme.font.weight.sans.regular};
  line-height: 16px;

  > span:last-child {
    white-space: normal;
    text-wrap: balance;
  }
`;
