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
      value={action.config.targetDisplay}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate({
          config: {
            targetType: action.config.targetType,
            targetDisplay: e.target.value,
          },
        });
        removeError(action.id);
      }}
    />
  );
}
