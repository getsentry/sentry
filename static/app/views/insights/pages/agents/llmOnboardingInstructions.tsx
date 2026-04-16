import {Fragment} from 'react';

import {Button} from '@sentry/scraps/button';

import {useCopySetupInstructionsEnabled} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCopyMarkdownButton';
import {IconCopy} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useOrganization} from 'sentry/utils/useOrganization';

export function ManualInstrumentationNote({docsLink}: {docsLink: React.ReactNode}) {
  const copyEnabled = useCopySetupInstructionsEnabled();

  if (copyEnabled) {
    return (
      <p>
        {tct(
          'Then follow the [link:manual instrumentation guide] to instrument your AI calls, or click [bold:Copy instructions] to have an AI coding agent do it for you.',
          {link: docsLink, bold: <strong />}
        )}
      </p>
    );
  }

  return (
    <Fragment>
      <p>
        {tct(
          'Then follow the [link:manual instrumentation guide] to instrument your AI calls, or use an AI coding agent to do it for you.',
          {link: docsLink}
        )}
      </p>
      <CopyLLMPromptButton />
    </Fragment>
  );
}

/**
 * @deprecated Will be removed when the `onboarding-copy-setup-instructions` feature flag GAs.
 */
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
> Then follow the skill references below for instrumentation and agent naming.

# Instrument Sentry AI Agent Monitoring

Use these skills as the source of truth:

## Skill References

- Source repository: https://github.com/getsentry/sentry-for-ai
- Agent-monitoring skill: https://skills.sentry.dev/sentry-setup-ai-monitoring/SKILL.md
`;
