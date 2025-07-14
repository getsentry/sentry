import {AutomationBuilderInput} from 'sentry/components/workflowEngine/form/automationBuilderInput';
import {t} from 'sentry/locale';
import {useActionNodeContext} from 'sentry/views/automations/components/actionNodes';
import {useAutomationBuilderErrorContext} from 'sentry/views/automations/components/automationBuilderErrorContext';

export function TargetDisplayField({placeholder}: {placeholder?: string}) {
  const {action, actionId, onUpdate} = useActionNodeContext();
  const {removeError} = useAutomationBuilderErrorContext();

  return (
    <AutomationBuilderInput
      name={`${actionId}.config.target_display`}
      aria-label={t('Target')}
      placeholder={placeholder ? placeholder : t('channel name or ID')}
      value={action.config.target_display}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate({
          config: {...action.config, target_display: e.target.value},
        });
        removeError(action.id);
      }}
    />
  );
}
