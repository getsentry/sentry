import {AutomationBuilderInput} from 'sentry/components/workflowEngine/form/automationBuilderInput';
import {t} from 'sentry/locale';
import {useActionNodeContext} from 'sentry/views/automations/components/actionNodes';

export function TargetDisplayField({placeholder}: {placeholder?: string}) {
  const {action, actionId, onUpdate} = useActionNodeContext();
  return (
    <AutomationBuilderInput
      name={`${actionId}.config.target_display`}
      placeholder={placeholder ? placeholder : t('channel name or ID')}
      value={action.config.target_display}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate({
          config: {...action.config, target_display: e.target.value},
        });
      }}
    />
  );
}
