import {t, tn} from 'sentry/locale';
import type {PinnedPageFilter} from 'sentry/types/core';
import {unreachable} from 'sentry/utils/unreachable';

/**
 * The reasons page filters may adjust a selection during initialization.
 *
 * `initializeUrlState` doesn't always apply the selection it's given: it drops
 * values the user can't access and substitutes defaults when nothing is
 * selected. Those adjustments are otherwise invisible, which is confusing on
 * pages that treat the selection as editable state (Dashboards renders a
 * "Save" button for it).
 */
export enum PageFilterAdjustmentReason {
  /**
   * Project ids in the URL or local storage that the user can't access were
   * dropped from the selection.
   */
  INVALID_PROJECTS = 'invalid_projects',
  /**
   * Environments in the URL or local storage that don't exist on any
   * accessible project were dropped from the selection.
   */
  INVALID_ENVIRONMENTS = 'invalid_environments',
  /**
   * Nothing was selected and the organization has exactly one project, so it
   * was selected automatically.
   */
  SINGLE_PROJECT_AUTO_SELECTED = 'single_project_auto_selected',
  /**
   * The user is a member of no projects but can access others, so the
   * selection fell back to "All Projects".
   */
  NO_MEMBER_PROJECTS = 'no_member_projects',
  /**
   * The selected date range starts further back than the organization's
   * retention allows, so it was shortened.
   */
  MAX_PICKABLE_DAYS = 'max_pickable_days',
  /**
   * The selected date range is longer than the maximum queryable range, so it
   * was shortened.
   */
  MAX_DATE_RANGE = 'max_date_range',
}

export interface PageFilterAdjustment {
  /**
   * The page filter whose value was adjusted. Used to clear the adjustment
   * once the user changes that filter themselves.
   */
  filter: PinnedPageFilter;
  reason: PageFilterAdjustmentReason;
  /**
   * The number of days the date range was shortened to. Only set for the
   * date range reasons.
   */
  days?: number;
  /**
   * The name of the project that was auto-selected. Only set for
   * `SINGLE_PROJECT_AUTO_SELECTED`.
   */
  projectSlug?: string;
}

/**
 * A user-facing explanation of why the selection was adjusted.
 */
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
