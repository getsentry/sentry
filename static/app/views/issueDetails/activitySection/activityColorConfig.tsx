import type {Theme} from '@emotion/react';

import {GroupActivityType} from 'sentry/types/group';

export function getActivityColorConfig(theme: Theme, type: GroupActivityType) {
  const defaultConfig = {
    title: theme.tokens.content.primary,
    icon: theme.tokens.content.secondary,
    iconBorder: theme.tokens.content.secondary,
  };

  switch (type) {
    case GroupActivityType.SET_RESOLVED:
    case GroupActivityType.SET_RESOLVED_BY_AGE:
    case GroupActivityType.SET_RESOLVED_IN_RELEASE:
    case GroupActivityType.SET_RESOLVED_IN_COMMIT:
    case GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST:
    case GroupActivityType.PULL_REQUEST_REOPENED:
    case GroupActivityType.PULL_REQUEST_MERGED:
    case GroupActivityType.MARK_REVIEWED:
    case GroupActivityType.SEER_RCA_COMPLETED:
    case GroupActivityType.SEER_SOLUTION_COMPLETED:
    case GroupActivityType.SEER_CODING_COMPLETED:
    case GroupActivityType.SEER_PR_CREATED:
    case GroupActivityType.SEER_ITERATION_COMPLETED:
      return {
        ...defaultConfig,
        icon: theme.tokens.graphics.success.vibrant,
        iconBorder: theme.tokens.border.success.vibrant,
      };
    case GroupActivityType.SET_UNRESOLVED:
    case GroupActivityType.SET_REGRESSION:
    case GroupActivityType.PULL_REQUEST_CLOSED:
    case GroupActivityType.PULL_REQUEST_UNLINKED:
      return {
        ...defaultConfig,
        icon: theme.tokens.graphics.danger.vibrant,
        iconBorder: theme.tokens.border.danger.vibrant,
      };
    case GroupActivityType.SET_ESCALATING:
    case GroupActivityType.SET_PRIORITY:
      return {
        ...defaultConfig,
        icon: theme.tokens.graphics.warning.vibrant,
        iconBorder: theme.tokens.border.warning.vibrant,
      };
    case GroupActivityType.SET_IGNORED:
      return {
        ...defaultConfig,
      };
    default:
      return defaultConfig;
  }
}
