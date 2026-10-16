import {t} from 'sentry/locale';

interface AgentSetupPromptOptions {
  intro: string;
  orgSlug: string;
  onboardingCode?: string;
}

export function buildAgentSetupPrompt({
  intro,
  orgSlug,
  onboardingCode,
}: AgentSetupPromptOptions): string {
  return [
    intro,
    t(
      'Name each Sentry project after its repository, in lowercase with hyphens (e.g. my-app).'
    ),
    t('If Sentry rejects that name, use the platform name instead (e.g. python).'),
    '',
    t('org slug: %s', orgSlug),
    ...(onboardingCode ? [t('run code: %s', onboardingCode)] : []),
  ].join('\n');
}
