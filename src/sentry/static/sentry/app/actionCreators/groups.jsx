import GroupActions from '../actions/groupActions';

export function addIssues(items = []) {
  GroupActions.addIssues(items);
}

export function resetGroups() {
  GroupActions.reset();
}
