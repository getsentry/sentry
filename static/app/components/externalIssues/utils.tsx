import type {FieldValue} from 'sentry/components/forms/types';
import type {IntegrationIssueConfig, IssueConfigField} from 'sentry/types/integrations';

export type ExternalIssueAction = 'create' | 'link';

export function getConfigName(
  action: ExternalIssueAction
): 'createIssueConfig' | 'linkIssueConfig' {
  switch (action) {
    case 'create':
      return 'createIssueConfig';
    case 'link':
      return 'linkIssueConfig';
    default:
      throw new Error('illegal action');
  }
}

/**
 * Convert IntegrationIssueConfig to an object that maps field names to the
 * values of fields where `updatesForm` is true.
 * @returns Object of field names to values.
 */
export function getDynamicFields({
  action,
  integrationDetails,
}: {
  action: ExternalIssueAction;
  integrationDetails?: IntegrationIssueConfig | null;
}): Record<string, FieldValue | null> {
  const config = integrationDetails?.[getConfigName(action)];
  return Object.fromEntries(
    (config || [])
      .filter((field: IssueConfigField) => field.updatesForm)
      .map((field: IssueConfigField) => [field.name, field.default || null])
  );
}
