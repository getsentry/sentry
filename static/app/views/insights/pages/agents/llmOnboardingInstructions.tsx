import {Button} from '@sentry/scraps/button';

import {IconCopy} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
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

export function CopyLLMPromptButton({
  platform = 'unknown',
  product,
}: {
  product: 'conversations' | 'agents';
  platform?: string;
}) {
  const {copy} = useCopyToClipboard();
  const organization = useOrganization();

  return (
    <Button
      size="sm"
      icon={<IconCopy />}
      onClick={() => {
        trackAnalytics('onboarding.ai_prompt_copied', {
          organization,
          platform,
          product,
          source: 'prompt',
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

export function getAgentSetupPrompt({
  organizationSlug,
  project,
  dsn,
}: {
  dsn: string;
  organizationSlug: string;
  project: Pick<Project, 'slug' | 'platform'>;
}) {
  // `dataCollection` is a JavaScript SDK option. Python and PHP scope AI content
  // capture differently, so only JavaScript projects get the question. Agent
  // monitoring offers no other languages, which makes JavaScript the else branch,
  // the same split the Conversations onboarding uses.
  const platform = project.platform ?? '';
  const isJavaScript = !platform.startsWith('python') && !platform.startsWith('php');

  // The instrument skill keeps AI capture on and only reacts once the user raises
  // a concern, so prompt for the question rather than leaving them to find it.
  const dataCollectionStep = isJavaScript
    ? `

Then ask me whether I want to control which AI inputs and outputs the SDK sends, and point me to the [data collection options](https://docs.sentry.io/platforms/javascript/configuration/options/#dataCollection).`
    : '';

  return `Read and follow https://skills.sentry.dev/instrument to set up Sentry agent tracing and conversations.

Use this existing project: ${organizationSlug}/${project.slug}
DSN: ${dsn}
Platform hint: ${project.platform || 'unknown'}${dataCollectionStep}

Then offer to set up the [Sentry plugin](https://docs.sentry.io/ai/agent-plugin/) so I can find and fix production issues from my coding agent.`;
}

/**
 * Contextual note prepended when the instructions follow onboarding setup
 * steps so the LLM knows to complete those first.
 */

export const LLM_ONBOARDING_COPY_MARKDOWN = `
> The setup steps above contain the correct DSN and project-specific SDK configuration — complete them first.
> Then follow the skill references below for instrumentation and agent naming.
> If the app has multi-turn chats, set a conversation ID for each chat so Sentry can send the gen_ai.conversation.id attribute and show the session in Conversations.
> Also call setUser (JS) / sentry_sdk.set_user (Python) once per request or session so conversations are attributed to users in the Conversations view.

# Instrument Sentry AI Agent Monitoring

Use curl to download, read and follow https://skills.sentry.dev/instrument to set up Sentry AI agent monitoring for this app.
`;
