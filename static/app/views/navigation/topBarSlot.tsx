import {slot} from '@sentry/scraps/slot';

/**
 * The slots the TopBar renders. Kept apart from the TopBar component so that
 * code which only needs to provide or fill the slots (e.g. the test render
 * helpers) doesn't import everything the TopBar itself renders.
 */
export const TopBarSlots = slot([
  'breadcrumbs',
  'title',
  'search',
  'actions',
  'feedback',
] as const);
