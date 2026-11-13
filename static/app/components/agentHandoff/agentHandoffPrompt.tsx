import {useState, type PointerEventHandler} from 'react';
import {css, ThemeProvider, type Theme} from '@emotion/react';
import styled from '@emotion/styled';
import {IconCopy} from '@sentry/icons/copy';
import {IconOpen} from '@sentry/icons/open';
import {IconSettings} from '@sentry/icons/settings';
import {useStore} from 'zustand';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {InfoText} from '@sentry/scraps/info';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';
import {darkTheme} from '@sentry/scraps/theme';
import {toast} from '@sentry/scraps/toast';

import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';

import {getHandoffPrompt} from './handoffPrompt';
import {
  AgentHandoffFlow,
  type AgentHandoffContext,
  useAgentHandoff,
} from './useAgentHandoff';
import {useHandoffPromptInteractions} from './useHandoffPromptInteractions';

interface AgentHandoffPromptProps<Flow extends AgentHandoffFlow> {
  context: AgentHandoffContext<Flow> | null;
  feedbackSource: string;
  flow: Flow;
  onCopySuccess?: () => void;
  onSelect?: () => void;
}

export function AgentHandoffPrompt<Flow extends AgentHandoffFlow>({
  context,
  feedbackSource,
  flow,
  onCopySuccess,
  onSelect,
}: AgentHandoffPromptProps<Flow>) {
  const links = useStore(ConfigStore, state => state.links);
  const [useIpPinning, setUseIpPinning] = useState(true);
  const [isPromptSelected, setIsPromptSelected] = useState(false);
  const handoff = useAgentHandoff(flow, context);
  const copyDisabled = !context || handoff.isPending;
  const previewUrl = new URL(`/agent-handoff/?preview=1&flow=${flow}`, links.sentryUrl)
    .href;

  function copyPrompt() {
    if (handoff.isPending) {
      return;
    }

    void handoff
      .copyPrompt({disableIpPinning: !useIpPinning})
      .then(() => {
        toast.success(t('Agent prompt copied to clipboard'));
        onCopySuccess?.();
      })
      .catch(() => null);
  }

  const {
    promptProps: {onCopy, onPointerDown, ref: promptRef, tabIndex},
  } = useHandoffPromptInteractions(copyPrompt);
  const handlePointerDown: PointerEventHandler<HTMLDivElement> = event => {
    onPointerDown(event);
    if (event.button === 0) {
      setIsPromptSelected(true);
      onSelect?.();
    }
  };

  function toggleIpPinning() {
    setUseIpPinning(enabled => !enabled);
    handoff.reset();
  }

  return (
    <Stack gap="md">
      <ThemeProvider theme={darkTheme}>
        <Container
          background="primary"
          border="primary"
          radius="md"
          padding="md xl"
          paddingRight="3xl"
          position="relative"
        >
          {promptBoxProps => (
            <PromptBox {...promptBoxProps} onCopy={onCopy}>
              <PromptText
                ref={promptRef}
                as="div"
                monospace
                size="sm"
                tabIndex={tabIndex}
                textWrap="wrap"
                onBlur={() => setIsPromptSelected(false)}
                onPointerDown={handlePointerDown}
              >
                {getHandoffPrompt('sntryh_****', maskedCode => (
                  <MaskedCode
                    data-selected={isPromptSelected || undefined}
                    monospace
                    variant="warning"
                    title={t('The secret code authorizes your agent on your behalf')}
                  >
                    {maskedCode}
                  </MaskedCode>
                ))}
              </PromptText>
              <Container position="absolute" top="8px" right="8px">
                <Button
                  aria-label={t('Copy agent prompt')}
                  busy={handoff.isPending}
                  disabled={copyDisabled}
                  icon={<IconCopy />}
                  size="zero"
                  variant="transparent"
                  onClick={copyPrompt}
                />
              </Container>
            </PromptBox>
          )}
        </Container>
      </ThemeProvider>

      <Flex align="center" justify="between" gap="lg">
        <Text size="sm">
          <ExternalLink href={previewUrl}>
            <Flex as="span" align="center" gap="xs">
              {t('See the full instructions')}
              <IconOpen size="xs" />
            </Flex>
          </ExternalLink>
        </Text>

        <Flex align="center" gap="sm">
          <FeedbackButton
            size="xs"
            feedbackOptions={{
              tags: {'feedback.source': feedbackSource},
            }}
          />

          <DropdownMenu
            closeOnSelect={false}
            items={[
              {
                key: 'ip-pinning',
                label: t('Use IP pinning'),
                details: t(
                  'Restricts the handoff code to your current IP address. Turn this off when your agent runs on a different network.'
                ),
                textValue: t('Use IP pinning'),
                disabled: copyDisabled,
                isSelected: useIpPinning,
                closeOnSelect: false,
                onAction: toggleIpPinning,
              },
            ]}
            maxWidth={360}
            position="bottom-end"
            shouldApplyMinWidth={false}
            size="xs"
            usePortal
            trigger={triggerProps => (
              <OverlayTrigger.Button
                {...triggerProps}
                aria-label={t('Advanced options')}
                icon={<IconSettings />}
                showChevron={false}
                size="xs"
                variant="transparent"
              >
                {t('Advanced')}
              </OverlayTrigger.Button>
            )}
          />
        </Flex>
      </Flex>

      {!useIpPinning && (
        <Alert variant="warning">
          {t(
            'Without IP pinning, anyone with this prompt can use its handoff code from any IP address to authorize an agent on your behalf. Avoid pasting your prompt when streaming or screen sharing.'
          )}
        </Alert>
      )}
      {handoff.error && <Alert variant="danger">{handoff.error.message}</Alert>}
    </Stack>
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
