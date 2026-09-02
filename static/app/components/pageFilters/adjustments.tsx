import {t, tn} from 'sentry/locale';
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

type ProjectsAdjustment =
  | {reason: PageFilterAdjustmentReason.INVALID_PROJECTS}
  | {reason: PageFilterAdjustmentReason.NO_MEMBER_PROJECTS}
  | {
      projectSlug: string;
      reason: PageFilterAdjustmentReason.SINGLE_PROJECT_AUTO_SELECTED;
    };

type EnvironmentsAdjustment = {
  reason: PageFilterAdjustmentReason.INVALID_ENVIRONMENTS;
};

type DatetimeAdjustment = {
  days: number;
  reason:
    | PageFilterAdjustmentReason.MAX_PICKABLE_DAYS
    | PageFilterAdjustmentReason.MAX_DATE_RANGE;
};

export type PageFilterAdjustment =
  | ProjectsAdjustment
  | EnvironmentsAdjustment
  | DatetimeAdjustment;

/**
 * Adjustments keyed by the filter they apply to. A filter can only be adjusted
 * for one reason — the reason describes the value we ended up with — and the
 * key is what lets the adjustment be cleared once the user changes that filter
 * themselves.
 */
export interface PageFilterAdjustments {
  datetime?: DatetimeAdjustment;
  environments?: EnvironmentsAdjustment;
  projects?: ProjectsAdjustment;
}

export function getPageFilterAdjustmentMessage(adjustment: PageFilterAdjustment): string {
  switch (adjustment.reason) {
    case PageFilterAdjustmentReason.INVALID_PROJECTS:
      return t(
        "Your project selection changed because it included projects you don't have access to."
      );
    case PageFilterAdjustmentReason.INVALID_ENVIRONMENTS:
      return t(
        "Your environment selection changed because it included environments that don't exist."
      );
    case PageFilterAdjustmentReason.SINGLE_PROJECT_AUTO_SELECTED:
      return t(
        'Your project selection changed to %s, the only project in this organization.',
        adjustment.projectSlug
      );
    case PageFilterAdjustmentReason.NO_MEMBER_PROJECTS:
      return t(
        "Your project selection changed to All Projects because you're not a member of any project in this organization."
      );
    case PageFilterAdjustmentReason.MAX_PICKABLE_DAYS:
      return tn(
        'Your date range changed to %s day, the longest range your organization can query.',
        'Your date range changed to %s days, the longest range your organization can query.',
        adjustment.days
      );
    case PageFilterAdjustmentReason.MAX_DATE_RANGE:
      return tn(
        'Your date range changed to %s day, the longest range this page can query.',
        'Your date range changed to %s days, the longest range this page can query.',
        adjustment.days
      );
    default:
      unreachable(adjustment);
      return '';
  }
}
