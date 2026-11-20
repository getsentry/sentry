import {Fragment, useState, type PointerEventHandler, type ReactNode} from 'react';
import {css, ThemeProvider, type Theme} from '@emotion/react';
import styled from '@emotion/styled';
import {IconSettings} from '@sentry/icons/settings';

import {Alert} from '@sentry/scraps/alert';
import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {InfoText} from '@sentry/scraps/info';
import {Container} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';
import {darkTheme} from '@sentry/scraps/theme';

import {t} from 'sentry/locale';

import {getHandoffGuideUrl, getHandoffPrompt} from './handoffPrompt';
import {AgentHandoffFlow, type AgentHandoffContext} from './types';
import {useHandoffPromptInteractions} from './useHandoffPromptInteractions';

export function getHandoffPreviewUrl(sentryUrl: string): string {
  return new URL('/agent-handoff.md', sentryUrl).href;
}

interface HandoffAdvancedMenuProps {
  disabled: boolean;
  onToggle: () => void;
  useIpPinning: boolean;
}

export function HandoffAdvancedMenu({
  disabled,
  useIpPinning,
  onToggle,
}: HandoffAdvancedMenuProps) {
  return (
    <DropdownMenu
      items={[
        {
          key: 'ip-pinning',
          label: t('Use IP pinning'),
          details: t(
            'Restricts the handoff code to your current IP address. Turn this off when your agent runs on a different network.'
          ),
          textValue: t('Use IP pinning'),
          disabled,
          isSelected: useIpPinning,
          onAction: onToggle,
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
  );
}

interface HandoffPromptAlertsProps {
  error: Error | null;
  useIpPinning: boolean;
}

export function HandoffPromptAlerts({useIpPinning, error}: HandoffPromptAlertsProps) {
  return (
    <Fragment>
      {!useIpPinning && (
        <Alert variant="warning">
          {t(
            'Without IP pinning, anyone with this prompt can use its handoff code from any IP address to authorize an agent on your behalf. Avoid pasting your prompt when streaming or screen sharing.'
          )}
        </Alert>
      )}
      {error && <Alert variant="danger">{error.message}</Alert>}
    </Fragment>
  );
}

interface HandoffPromptBoxProps<Flow extends AgentHandoffFlow> {
  context: AgentHandoffContext<Flow> | null;
  flow: Flow;
  onCopyPrompt: () => void;
  onSelect?: () => void;
  topRightAction?: ReactNode;
}

export function HandoffPromptBox<Flow extends AgentHandoffFlow>({
  context,
  flow,
  onCopyPrompt,
  onSelect,
  topRightAction,
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
        borderColor="primary"
        radius="md"
        padding="md xl"
        paddingRight={topRightAction ? '3xl' : 'xl'}
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
            {topRightAction && (
              <Container position="absolute" top="8px" right="8px">
                {topRightAction}
              </Container>
            )}
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
