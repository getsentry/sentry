import GroupActions from '../actions/groupActions';

export function addIssues(items = []) {
  GroupActions.addIssues(items);
}

export function resetIssues() {
  GroupActions.reset();
}

export function loadIssues(items) {
  GroupActions.load(items);
}
