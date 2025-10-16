import {useCallback, useEffect, useState} from 'react';

import {
  getDynamicFields,
  type ExternalIssueAction,
} from 'sentry/components/externalIssues/utils';
import type {FieldValue} from 'sentry/components/forms/types';
import type {IntegrationIssueConfig} from 'sentry/types/integrations';

interface UseDynamicFieldsProps {
  action: ExternalIssueAction;
  integrationDetails: IntegrationIssueConfig | null;
}

export function useDynamicFields({action, integrationDetails}: UseDynamicFieldsProps) {
  // Manage a state mapping field name to values.
  const [dynamicFieldValues, setDynamicFieldValues] = useState<
    Record<string, FieldValue>
  >({});

  // Update a single entry of the dynamic field state.
  const setDynamicFieldValue = useCallback((fieldName: string, value: FieldValue) => {
    setDynamicFieldValues(prev => ({...prev, [fieldName]: value}));
  }, []);

  // If we ever refetch the action or config, replace the state with the response
  useEffect(() => {
    setDynamicFieldValues(getDynamicFields({action, integrationDetails}));
  }, [action, integrationDetails]);
  return {dynamicFieldValues, setDynamicFieldValue, setDynamicFieldValues};
}
