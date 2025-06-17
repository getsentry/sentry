import {EmptyCell} from 'sentry/components/workflowEngine/gridCell/emptyCell';
import type {ActionType} from 'sentry/types/workflowEngine/actions';
import {AutomationActionSummary} from 'sentry/views/automations/components/automationActionSummary';

type ActionCellProps = {
  actions: ActionType[];
  disabled?: boolean;
};

export function ActionCell({actions}: ActionCellProps) {
  if (!actions || actions.length === 0) {
    return <EmptyCell />;
  }

  return <AutomationActionSummary actions={actions} hasTooltip />;
}
