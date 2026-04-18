import {useMemo} from 'react';

import {Button} from '@sentry/scraps/button';

import {openModal} from 'sentry/actionCreators/modal';
import {TicketRuleModal} from 'sentry/components/externalIssues/ticketRuleModal';
import {IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {TicketActionData} from 'sentry/types/alerts';
import type {Choices} from 'sentry/types/core';
import type {TicketCreationAction} from 'sentry/types/workflowEngine/actions';
import {
  actionNodesMap,
  useActionNodeContext,
} from 'sentry/views/automations/components/actionNodes';
import {useAutomationFormContext} from 'sentry/views/automations/components/forms/context';

export function TicketActionSettingsButton() {
  const {action, onUpdate} = useActionNodeContext();
  const {automation} = useAutomationFormContext();

  const ticketAction = action as TicketCreationAction;

  const updateParentFromTicketRule = (
    formData: Record<string, string>,
    fetchedFieldOptionsCache: Record<string, Choices>
  ): void => {
    // We only know the choices after the form loads.
    formData.dynamic_form_fields = ((formData.dynamic_form_fields as any) || []).map(
      (field: any) => {
        // Overwrite the choices because the user's pick is in this list.
        if (
          field.name in formData &&
          fetchedFieldOptionsCache?.hasOwnProperty(field.name)
        ) {
          field.choices = fetchedFieldOptionsCache[field.name];
        }
        return field;
      }
    );

    const {dynamic_form_fields, ...additionalFields} = formData;

    onUpdate({
      data: {dynamic_form_fields, additional_fields: additionalFields},
    });
  };

  // Find saved action data from the API response
  const savedActionData = useMemo(() => {
    if (!automation) return undefined;

    for (const af of automation.actionFilters) {
      const found = af.actions?.find(a => a.id === action.id);
      if (found) return found.data;
    }

    return undefined;
  }, [automation, action.id]);

  const additionalFields =
    ticketAction.data.additional_fields ??
    savedActionData?.additionalFields ??
    savedActionData?.additional_fields;

  const dynamicFormFields = ticketAction.data.dynamic_form_fields?.length
    ? ticketAction.data.dynamic_form_fields
    : (savedActionData?.dynamicFormFields ?? savedActionData?.dynamic_form_fields ?? []);

  const instance = {
    ...additionalFields,
    integration: ticketAction.integrationId,
    dynamic_form_fields: dynamicFormFields,
  } as TicketActionData;

  return (
    <Button
      size="sm"
      icon={<IconSettings />}
      onClick={() =>
        openModal(deps => (
          <TicketRuleModal
            {...deps}
            instance={instance}
            onSubmitAction={updateParentFromTicketRule}
            link={actionNodesMap.get(action.type)?.link || null}
            ticketType={
              actionNodesMap.get(action.type)?.ticketType || t('an external issue')
            }
          />
        ))
      }
      disabled={!ticketAction.integrationId}
    >
      {t('Action Settings')}
    </Button>
  );
}
