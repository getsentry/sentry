import {Button} from '@sentry/scraps/button';

import {IconCopy} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useOrganization} from 'sentry/utils/useOrganization';

export function ManualInstrumentationNote({docsLink}: {docsLink: React.ReactNode}) {
  return (
    <p>
      {tct(
        'Then follow the [link:manual instrumentation guide] to instrument your AI calls, or click [bold:Copy instructions] to have an AI coding agent do it for you.',
        {link: docsLink, bold: <strong />}
      )}
    </p>
  );
}

export function CopyLLMPromptButton() {
  const {copy} = useCopyToClipboard();
  const organization = useOrganization();

  return (
    <Button
      size="sm"
      icon={<IconCopy />}
      onClick={() => {
        trackAnalytics('agent-monitoring.copy-llm-prompt-click', {
          organization,
        });
        copy(LLM_ONBOARDING_COPY_MARKDOWN, {
          successMessage: t('Copied instrumentation prompt to clipboard'),
        });
      }}
    >
      {t('Copy Prompt for AI Agent')}
    </Button>
  );
}

/**
 * Contextual note prepended when the instructions follow onboarding setup
 * steps so the LLM knows to complete those first.
 */

export const LLM_ONBOARDING_COPY_MARKDOWN = `
> The setup steps above contain the correct DSN and project-specific SDK configuration — complete them first.
> Then follow the docs references below for instrumentation and agent naming.
> If the app has multi-turn chats, set a conversation ID for each chat so Sentry can send the gen_ai.conversation.id attribute and show the session in Conversations.
> Also call setUser (JS) / sentry_sdk.set_user (Python) once per request or session so conversations are attributed to users in the Conversations view.

# Instrument Sentry AI Agent Monitoring

Read and follow https://docs.sentry.io/product/agents/getting-started.md to set up Sentry AI agent monitoring for this app.

Platform-specific instrumentation:
- JavaScript/Node: https://docs.sentry.io/platforms/javascript/guides/node/agent-tracing.md
- Python: https://docs.sentry.io/platforms/python/tracing/instrumentation/custom-instrumentation/ai-agents-module.md
`;
