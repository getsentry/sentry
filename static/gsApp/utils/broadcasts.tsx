import {categoryList} from 'sentry/data/platformPickerCategories';
import {allPlatforms as platforms} from 'sentry/data/platforms';

type BroadcastChoice = {label: string; value: string};

export const REGIONCHOICES: readonly BroadcastChoice[] = [
  {value: 'us', label: 'US'},
  {value: 'de', label: 'DE'},
];

const exposedPlatformCategoriesSet = new Set([
  'browser',
  'server',
  'mobile',
  'desktop',
  'serverless',
]);

export const platformOptions = categoryList
  .filter(({id}) => exposedPlatformCategoriesSet.has(id))
  .map(({name, platforms: platformKeys}) => ({
    label: name,
    options: Array.from(platformKeys, platformKey => {
      const platform = platforms.find(p => p.id === platformKey);
      return {
        value: platformKey,
        label: platform?.name ?? platformKey,
      };
    }),
  }));

export const PLATFORMCHOICES = platformOptions.flatMap(
  platformChoice => platformChoice.options
);

export const PRODUCTCHOICES: readonly BroadcastChoice[] = [
  {value: 'errors', label: 'Errors'},
  {value: 'spans', label: 'Spans'},
  {value: 'replays', label: 'Replays'},
  {value: 'profiling', label: 'Profiling'},
  {value: 'crons', label: 'Crons'},
];

export const TRIALCHOICES: readonly BroadcastChoice[] = [
  {value: 'trialing', label: 'Trialing'},
  {value: 'can_trial', label: 'Can Trial'},
  {value: 'has_trialed', label: 'Has Trialed'},
];

export const ROLECHOICES: readonly BroadcastChoice[] = [
  {value: 'admin', label: 'Admin'},
  {value: 'billing', label: 'Billing'},
  {value: 'manager', label: 'Manager'},
  {value: 'member', label: 'Member'},
  {value: 'owner', label: 'Owner'},
];

export const AVAILABLE_PLANCHOICES: readonly BroadcastChoice[] = [
  {value: 'free', label: 'Free'},
  {value: 'team', label: 'Team'},
  {value: 'business', label: 'Business'},
  {value: 'enterprise', label: 'Enterprise'},
];

export const ALL_PLANCHOICES: readonly BroadcastChoice[] = [
  {value: 'paid_non_business', label: 'Paid Non-Business/Enterprise'},
  ...AVAILABLE_PLANCHOICES,
];

/**
 * Category of the broadcast.
 * Synced with https://github.com/getsentry/sentry/blob/master/src/sentry/models/broadcast.py#L14
 */
export const CATEGORYCHOICES: readonly BroadcastChoice[] = [
  {value: 'announcement', label: 'Announcement'},
  {value: 'feature', label: 'New Feature'},
  {value: 'blog', label: 'Blog Post'},
  {value: 'event', label: 'Event'},
  {value: 'video', label: 'Video'},
];
