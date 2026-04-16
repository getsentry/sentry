import type {CodingAgentIntegration} from 'sentry/components/events/autofix/useAutofix';
import {t} from 'sentry/locale';

export function getAgentId(
  selected: 'seer' | CodingAgentIntegration | undefined
): string {
  if (!selected || selected === 'seer') {
    return 'seer';
  }
  return selected.id ?? 'seer';
}

export function buildAgentOptions(
  integrations: CodingAgentIntegration[]
): Array<{label: string; value: string}> {
  return [
    {value: 'seer', label: t('Seer Agent')},
    ...integrations
      .filter((i): i is CodingAgentIntegration & {id: string} => Boolean(i.id))
      .map(i => ({value: i.id, label: i.name})),
  ];
}
