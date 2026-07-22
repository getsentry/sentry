import {t} from 'sentry/locale';

export function getAutofixTriggerActivityCopy(referrer: string | undefined) {
  switch (referrer) {
    case 'slack':
      return {
        compactTitle: t('Autofix triggered from Slack'),
        legacyMessage: t('Autofix was triggered from Slack'),
      };
    case 'issue_summary.post_process_fixability':
      return {
        compactTitle: t('Autofix triggered automatically after event ingestion'),
        legacyMessage: t('Autofix was triggered automatically after event ingestion'),
      };
    case 'night_shift':
      return {
        compactTitle: t('Autofix triggered during agentic triage'),
        legacyMessage: t('Autofix was triggered during agentic triage'),
      };
    default:
      return {
        compactTitle: t('Autofix triggered'),
        legacyMessage: t('Autofix was triggered'),
      };
  }
}
