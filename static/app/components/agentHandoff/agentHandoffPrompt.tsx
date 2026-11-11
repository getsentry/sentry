import {useState, type PointerEventHandler} from 'react';
import {ThemeProvider} from '@emotion/react';
import styled from '@emotion/styled';
import {IconCopy} from '@sentry/icons/copy';
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
import {t, tct} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';

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
  const urlPrefix = useStore(ConfigStore, state => state.urlPrefix);
  const [useIpPinning, setUseIpPinning] = useState(true);
  const handoff = useAgentHandoff(flow, context);
  const copyDisabled = !context || handoff.isPending;
  const guideUrl = `${urlPrefix.replace(/\/$/, '')}/agent-handoff/`;
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
          background="secondary"
          radius="md"
          padding="lg"
          paddingRight="3xl"
          position="relative"
          onCopy={onCopy}
        >
          <Text
            ref={promptRef}
            as="div"
            monospace
            size="sm"
            tabIndex={tabIndex}
            textWrap="wrap"
            onPointerDown={handlePointerDown}
          >
            {tct(
              'Fetch and follow the instructions at [guideUrl]. Your secret token is [token].',
              {
                guideUrl,
                token: (
                  <MaskedToken
                    monospace
                    variant="warning"
                    title={t('The secret token authenticates the CLI via this prompt')}
                  >
                    sntryh_****
                  </MaskedToken>
                ),
              }
            )}
          </Text>
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
        </Container>
      </ThemeProvider>

      <Flex align="center" justify="between" gap="lg">
        <Text size="sm">
          <ExternalLink href={previewUrl}>{t('See the full instructions')}</ExternalLink>
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
                  'Only allows this prompt to be claimed from your IP address. Disable this when your agent runs on a different network than your local machine.'
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
            'Without IP pinning, anyone with this prompt can use it from any IP address to authenticate the Sentry CLI to your account. Avoid pasting your prompt when streaming or screen sharing.'
          )}
        </Alert>
      )}
      {handoff.error && <Alert variant="danger">{handoff.error.message}</Alert>}
    </Stack>
  );
}

const MaskedToken = styled(InfoText)`
  background: ${p => p.theme.tokens.background.transparent.warning.muted};
  border-radius: ${p => p.theme.radius.sm};
  padding: 0 ${p => p.theme.space['2xs']};
  text-decoration: none;
`;
