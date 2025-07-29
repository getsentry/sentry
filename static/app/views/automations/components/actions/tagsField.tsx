import {AutomationBuilderInput} from 'sentry/components/workflowEngine/form/automationBuilderInput';
import {t} from 'sentry/locale';
import {useActionNodeContext} from 'sentry/views/automations/components/actionNodes';

export function TagsField() {
  const {action, actionId, onUpdate} = useActionNodeContext();
  return (
    <AutomationBuilderInput
      name={`${actionId}.data.tags`}
      aria-label={t('Tags')}
      placeholder={t('example tags')}
      value={action.data.tags}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate({
          data: {...action.data, tags: e.target.value},
        });
      }}
    />
  );
}
