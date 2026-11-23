import {Fragment, useId, useState, type PointerEventHandler} from 'react';
import {css, ThemeProvider, useTheme, type Theme} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {Alert} from '@sentry/scraps/alert';
import {Checkbox} from '@sentry/scraps/checkbox';
import {InfoText, InfoTip} from '@sentry/scraps/info';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {darkTheme} from '@sentry/scraps/theme';

import {t} from 'sentry/locale';

import {getHandoffGuideUrl, getHandoffPrompt} from './handoffPrompt';
import {AgentHandoffFlow, type AgentHandoffContext} from './types';
import {useHandoffPromptInteractions} from './useHandoffPromptInteractions';

interface HandoffIpPinningCheckboxProps {
  disabled: boolean;
  onToggle: () => void;
  useIpPinning: boolean;
}

export function HandoffIpPinningCheckbox({
  disabled,
  useIpPinning,
  onToggle,
}: HandoffIpPinningCheckboxProps) {
  const checkboxId = useId();
  const descriptionId = useId();

  return (
    <Flex align="start" gap="md">
      <Checkbox
        id={checkboxId}
        aria-describedby={descriptionId}
        checked={useIpPinning}
        disabled={disabled}
        onChange={onToggle}
      />
      <Stack gap="sm">
        <Flex align="center" gap="xs">
          <Text as="label" htmlFor={checkboxId} size="md">
            {t('Only allow this network')}
          </Text>
          <InfoTip
            size="xs"
            title={t('Keeps your secret token safe if the prompt leaks.')}
          />
        </Flex>
        <IpPinningDescription id={descriptionId} size="sm" variant="muted">
          {t('Uncheck if your agent runs in the cloud, or you use iCloud Private Relay.')}
        </IpPinningDescription>
      </Stack>
    </Flex>
  );
}

// Help text reads best a little looser than the largest density token (1.4).
const IpPinningDescription = styled(Text)`
  line-height: 1.5;
`;

interface HandoffPromptAlertsProps {
  error: Error | null;
  useIpPinning: boolean;
}

export function HandoffPromptAlerts({useIpPinning, error}: HandoffPromptAlertsProps) {
  const theme = useTheme();
  // Both prompts render the alerts in a Stack with an md gap. Pulling the warning
  // up by that gap while collapsed lets the gap animate with it instead of popping.
  const collapsedOffset = `-${theme.space.md}`;

  return (
    <Fragment>
      <AnimatePresence initial={false}>
        {!useIpPinning && (
          <motion.div
            initial={{height: 0, opacity: 0, marginTop: collapsedOffset}}
            animate={{height: 'auto', opacity: 1, marginTop: '0px'}}
            exit={{height: 0, opacity: 0, marginTop: collapsedOffset}}
            transition={{duration: 0.12, ease: 'easeOut'}}
            style={{overflow: 'hidden'}}
          >
            <Alert variant="warning">
              {t(
                'Without IP pinning, anyone with this prompt can use its handoff code from any IP address to authorize an agent on your behalf. Avoid pasting your prompt when streaming or screen sharing.'
              )}
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>
      {error && <Alert variant="danger">{error.message}</Alert>}
    </Fragment>
  );
}

interface HandoffPromptBoxProps<Flow extends AgentHandoffFlow> {
  context: AgentHandoffContext<Flow> | null;
  flow: Flow;
  onCopyPrompt: () => void;
  onSelect?: () => void;
  /** `md` sets the prompt in larger, looser monospace text with roomier vertical padding. */
  size?: 'sm' | 'md';
}

export function HandoffPromptBox<Flow extends AgentHandoffFlow>({
  context,
  flow,
  onCopyPrompt,
  onSelect,
  size = 'sm',
}: HandoffPromptBoxProps<Flow>) {
  const [isPromptSelected, setIsPromptSelected] = useState(false);
  const guideUrl = getHandoffGuideUrl();

  const {
    promptProps: {onCopy, onPointerDown, ref: promptRef, tabIndex},
  } = useHandoffPromptInteractions(onCopyPrompt);

  const handlePointerDown: PointerEventHandler<HTMLDivElement> = event => {
    onPointerDown(event);
    if (event.button === 0) {
      setIsPromptSelected(true);
      onSelect?.();
    }
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <Container
        background="primary"
        border="primary"
        radius="md"
        padding={size === 'md' ? 'lg xl' : 'md xl'}
      >
        {promptBoxProps => (
          <PromptBox {...promptBoxProps} onCopy={onCopy}>
            <PromptText
              ref={promptRef}
              as="div"
              monospace
              size={size}
              density={size === 'md' ? 'comfortable' : undefined}
              tabIndex={tabIndex}
              textWrap="wrap"
              onBlur={() => setIsPromptSelected(false)}
              onPointerDown={handlePointerDown}
            >
              {getHandoffPrompt(flow, context, {
                url: (
                  // Stop the prompt from selecting itself so the click opens the link.
                  <ExternalLink
                    href={guideUrl}
                    onPointerDown={event => event.stopPropagation()}
                  >
                    {guideUrl}
                  </ExternalLink>
                ),
                code: (
                  <MaskedCode
                    data-selected={isPromptSelected || undefined}
                    monospace
                    variant="warning"
                    title={t('The secret code authorizes your agent on your behalf')}
                  >
                    sntryh_****
                  </MaskedCode>
                ),
              })}
            </PromptText>
          </PromptBox>
        )}
      </Container>
    </ThemeProvider>
  );
}

const PromptBox = styled('div')`
  box-shadow: inset 0 1px 0
    ${p => p.theme.tokens.interactive.chonky.debossed.neutral.chonk};
`;

const accentSelection = (p: {theme: Theme}) => css`
  &::selection {
    background: ${p.theme.tokens.background.accent.vibrant};
    color: ${p.theme.tokens.content.onVibrant.light};
  }
`;

const PromptText = styled(Text)`
  ${accentSelection}

  /* Focus is only set programmatically to select the prompt; it is not tabbable. */
  &:focus {
    outline: none;
  }
`;

const MaskedCode = styled(InfoText)`
  position: relative;
  isolation: isolate;
  text-decoration: none;
  ${accentSelection}

  &::before {
    content: '';
    position: absolute;
    inset: 0 calc(-1 * ${p => p.theme.space.xs});
    z-index: -1;
    background: ${p => p.theme.tokens.background.transparent.warning.muted};
    border-radius: ${p => p.theme.radius.xs};
    pointer-events: none;
  }

  &[data-selected]::before {
    display: none;
  }
`;
