import {Dataset} from 'app/views/settings/incidentRules/types';

import {AlertType, WizardRuleTemplate} from './options';

const alertTypeIdentifiers: Record<Dataset, Partial<Record<AlertType, string>>> = {
  [Dataset.ERRORS]: {
    num_errors: 'count()',
    users_experiencing_errors: 'count_unique(tags[sentry:user])',
  },
  [Dataset.TRANSACTIONS]: {
    throughput: 'count()',
    trans_duration: 'transaction.duration',
    lcp: 'measurements.lcp',
  },
};

export function getAlertTypeFromAggregateDataset({
  aggregate,
  dataset,
}: Pick<WizardRuleTemplate, 'aggregate' | 'dataset'>): AlertType {
  const identifiersForDataset = alertTypeIdentifiers[dataset];
  const matchingAlertTypeEntry = Object.entries(identifiersForDataset).find(
    ([_alertType, identifier]) => identifier && aggregate.includes(identifier)
  );
  const alertType = matchingAlertTypeEntry && (matchingAlertTypeEntry[0] as AlertType);
  return alertType ? alertType : 'num_errors';
}
