import {AutomationBuilderSelect} from 'sentry/components/workflowEngine/form/automationBuilderSelect';
import {tct} from 'sentry/locale';
import {useAutomationBuilderErrorContext} from 'sentry/views/automations/components/automationBuilderErrorContext';
import {useDataConditionNodeContext} from 'sentry/views/automations/components/dataConditionNodes';

const MOCK_OPTIONS = [
  {value: 1, label: 'Error'},
  {value: 6, label: 'Feedback'},
  {value: 10, label: 'Outage'},
  {value: 11, label: 'Metric'},
  {value: 12, label: 'DB Query'},
  {value: 13, label: 'HTTP Client'},
  {value: 14, label: 'Frontend'},
  {value: 15, label: 'Mobile'},
];

export function IssueTypeNode() {
  // TODO - Select the types from an API request

  const {condition, condition_id, onUpdate} = useDataConditionNodeContext();
  const {removeError} = useAutomationBuilderErrorContext();

  return tct('Issue type is equal to [issueType]', {
    issueType: (
      <AutomationBuilderSelect
        name={`${condition_id}.comparison.value`}
        value={condition.comparison.value}
        options={MOCK_OPTIONS}
        onChange={(option: any) => {
          onUpdate({comparison: {value: option.value}});
          removeError(condition.id);
        }}
      />
    ),
  });
}
