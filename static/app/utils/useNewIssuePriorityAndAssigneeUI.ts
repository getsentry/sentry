import {useOrganization} from './useOrganization';

export function useNewIssuePriorityAndAssigneeUI() {
  const organization = useOrganization();

  return organization.features.includes('issue-priority-assignee-ui');
}
