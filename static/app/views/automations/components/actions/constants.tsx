export const OPSGENIE_PRIORITIES = ['P1', 'P2', 'P3', 'P4', 'P5'];

export const PAGERDUTY_SEVERITIES = ['default', 'critical', 'warning', 'error', 'info'];

export enum TargetType {
  USER = 'user',
  TEAM = 'team',
  ISSUE_OWNERS = 'issue_owners',
}

export const TARGET_TYPE_CHOICES = [
  {value: TargetType.ISSUE_OWNERS, label: 'Suggested assignees'},
  {value: TargetType.TEAM, label: 'Team'},
  {value: TargetType.USER, label: 'Member'},
];

enum FallthroughChoiceType {
  ALL_MEMBERS = 'AllMembers',
  ACTIVE_MEMBERS = 'ActiveMembers',
  NO_ONE = 'NoOne',
}

export const FALLTHROUGH_CHOICES = [
  {value: FallthroughChoiceType.ACTIVE_MEMBERS, label: 'Recently Active Members'},
  {value: FallthroughChoiceType.ALL_MEMBERS, label: 'All Project Members'},
  {value: FallthroughChoiceType.NO_ONE, label: 'No One'},
];
