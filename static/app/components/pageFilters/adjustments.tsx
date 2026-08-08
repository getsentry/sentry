import {t, tn} from 'sentry/locale';
import type {PinnedPageFilter} from 'sentry/types/core';
import {unreachable} from 'sentry/utils/unreachable';

/**
 * Ways `initializeUrlState` may adjust the selection it was given.
 */
export enum PageFilterAdjustmentReason {
  INVALID_PROJECTS = 'invalid_projects',
  INVALID_ENVIRONMENTS = 'invalid_environments',
  SINGLE_PROJECT_AUTO_SELECTED = 'single_project_auto_selected',
  NO_MEMBER_PROJECTS = 'no_member_projects',
  MAX_PICKABLE_DAYS = 'max_pickable_days',
  MAX_DATE_RANGE = 'max_date_range',
}

export interface PageFilterAdjustment {
  /**
   * Which filter was adjusted, so the adjustment can be cleared once the user
   * changes that filter themselves.
   */
  filter: PinnedPageFilter;
  reason: PageFilterAdjustmentReason;
  days?: number;
  projectSlug?: string;
}

export function getPageFilterAdjustmentMessage(adjustment: PageFilterAdjustment): string {
  const {reason, days, projectSlug} = adjustment;

  switch (reason) {
    case PageFilterAdjustmentReason.INVALID_PROJECTS:
      return t(
        "Your project selection changed because it included projects you don't have access to."
      );
    case PageFilterAdjustmentReason.INVALID_ENVIRONMENTS:
      return t(
        "Your environment selection changed because it included environments that don't exist."
      );
    case PageFilterAdjustmentReason.SINGLE_PROJECT_AUTO_SELECTED:
      return projectSlug
        ? t(
            'Your project selection changed to %s, the only project in this organization.',
            projectSlug
          )
        : t('Your project selection changed to the only project in this organization.');
    case PageFilterAdjustmentReason.NO_MEMBER_PROJECTS:
      return t(
        "Your project selection changed to All Projects because you're not a member of any project in this organization."
      );
    case PageFilterAdjustmentReason.MAX_PICKABLE_DAYS:
      return days
        ? tn(
            'Your date range changed to %s day, the longest range your organization can query.',
            'Your date range changed to %s days, the longest range your organization can query.',
            days
          )
        : t('Your date range changed to the longest range your organization can query.');
    case PageFilterAdjustmentReason.MAX_DATE_RANGE:
      return days
        ? tn(
            'Your date range changed to %s day, the longest range this page can query.',
            'Your date range changed to %s days, the longest range this page can query.',
            days
          )
        : t('Your date range changed to the longest range this page can query.');
    default:
      unreachable(reason);
      return '';
  }
}
