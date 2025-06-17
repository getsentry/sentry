import AutomationBuilderInputField from 'sentry/components/workflowEngine/form/automationBuilderInputField';
import {t} from 'sentry/locale';
import {useActionNodeContext} from 'sentry/views/automations/components/actionNodes';

export function TagsField() {
  const {action, actionId, onUpdate} = useActionNodeContext();
  return (
    <AutomationBuilderInputField
      name={`${actionId}.data.tags`}
      placeholder={t('example tags')}
      value={action.data.tags}
      onChange={(value: string) => {
        onUpdate({
          data: {tags: value},
        });
      }}
    />
  );
}
