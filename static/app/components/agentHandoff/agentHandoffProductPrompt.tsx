import type {ReactNode} from 'react';
import {IconCheckmark} from '@sentry/icons/checkmark';
import {IconOpen} from '@sentry/icons/open';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {t} from 'sentry/locale';

import {
  getHandoffPreviewUrl,
  HandoffAdvancedMenu,
  HandoffPromptAlerts,
  HandoffPromptBox,
  useHandoffPromptCopy,
  useSentryUrl,
} from './handoffPromptParts';
import {AgentHandoffFlow, type AddFeatureContext} from './useAgentHandoff';

interface AgentHandoffProductPromptProps {
  /**
   * List of benefits the agent will deliver, shown as checkmark bullets.
   * Keep to 3–5 short phrases. The last item should be omitted if you are relying
   * on the "View all instructions" link to cover extra detail.
   */
  benefits: ReactNode[];
  feedbackSource: string;
  context?: AddFeatureContext | null;
  /** Receives the ID of the handoff whose prompt was copied, for analytics. */
  onCopySuccess?: (handoffId: string) => void;
}

/**
 * Agent-tab content for product empty-state setup cards (see `ProductSetupCard`).
 *
 * Renders the dark prompt box, a primary "Copy prompt" button, the feedback and
 * advanced controls, and a "Your agent will:" benefit list. It is always wired to
 * `AgentHandoffFlow.ADD_FEATURE`; the `context` prop supplies the target product and
 * project.
 */
export function AgentHandoffProductPrompt({
  benefits,
  context = null,
  feedbackSource,
  onCopySuccess,
}: AgentHandoffProductPromptProps) {
  const sentryUrl = useSentryUrl();
  const previewUrl = getHandoffPreviewUrl(AgentHandoffFlow.ADD_FEATURE, sentryUrl);

  const {copyPrompt, copyDisabled, handoff, useIpPinning, toggleIpPinning} =
    useHandoffPromptCopy({
      flow: AgentHandoffFlow.ADD_FEATURE,
      context: context ?? null,
      onCopySuccess,
    });

  return (
    <Stack gap="md">
      <HandoffPromptBox product={context?.product} onCopyPrompt={copyPrompt} />

      <Flex align="center" gap="sm" wrap="wrap">
        <Button
          busy={handoff.isPending}
          disabled={copyDisabled}
          priority="primary"
          size="sm"
          onClick={copyPrompt}
        >
          {t('Copy prompt')}
        </Button>

        <FeedbackButton
          size="sm"
          feedbackOptions={{
            tags: {'feedback.source': feedbackSource},
          }}
        />

        <HandoffAdvancedMenu
          disabled={copyDisabled}
          useIpPinning={useIpPinning}
          onToggle={toggleIpPinning}
        />
      </Flex>

      <HandoffPromptAlerts useIpPinning={useIpPinning} error={handoff.error} />

      <Stack as="ul" role="list" gap="xs" padding="0" margin="0">
        <Text as="li" size="sm" variant="secondary">
          {t('Your agent will:')}
        </Text>
        {benefits.map((benefit, i) => (
          <Benefit key={i}>{benefit}</Benefit>
        ))}
        <Text as="li" size="sm">
          <ExternalLink href={previewUrl}>
            <Flex as="span" align="center" gap="xs">
              {t('View all instructions')}
              <IconOpen size="xs" />
            </Flex>
          </ExternalLink>
        </Text>
      </Stack>
    </Stack>
  );
}

function Benefit({children}: {children: ReactNode}) {
  return (
    <Flex as="li" align="center" gap="sm">
      <IconCheckmark size="sm" variant="success" />
      <Text size="sm">{children}</Text>
    </Flex>
  );
}
