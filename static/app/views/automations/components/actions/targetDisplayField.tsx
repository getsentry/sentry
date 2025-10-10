import {AutomationBuilderInput} from 'sentry/components/workflowEngine/form/automationBuilderInput';
import {t} from 'sentry/locale';
import {useActionNodeContext} from 'sentry/views/automations/components/actionNodes';
import {useAutomationBuilderErrorContext} from 'sentry/views/automations/components/automationBuilderErrorContext';

export function TargetDisplayField({placeholder}: {placeholder?: string}) {
  const {action, actionId, onUpdate} = useActionNodeContext();
  const {removeError} = useAutomationBuilderErrorContext();

  return (
    <AutomationBuilderInput
      name={`${actionId}.config.targetDisplay`}
      aria-label={t('Target')}
      placeholder={placeholder ? placeholder : t('channel name or ID')}
      value={action.config.targetDisplay ?? ''}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate({
          config: {
            ...action.config,
            targetDisplay: e.target.value,
          },
        });
        removeError(action.id);
      }}
    />
  );
}

export function TargetIdentifierField({placeholder}: {placeholder?: string}) {
  const {action, actionId, onUpdate} = useActionNodeContext();
  const {removeError} = useAutomationBuilderErrorContext();

  return (
    <AutomationBuilderInput
      name={`${actionId}.config.targetIdentifier`}
      aria-label={t('Target ID')}
      placeholder={placeholder}
      value={action.config.targetIdentifier ?? ''}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate({
          config: {
            ...action.config,
            targetIdentifier: e.target.value,
          },
        });
        removeError(action.id);
      }}
    />
  );
}
