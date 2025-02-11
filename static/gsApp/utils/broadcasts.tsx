import platformCategories from 'sentry/data/platformPickerCategories';
import platforms from 'sentry/data/platforms';

export const REGIONCHOICES = [
  ['us', 'US'],
  ['de', 'DE'],
] as const;

const exposedPlatformCategoriesSet = new Set([
  'browser',
  'server',
  'mobile',
  'desktop',
  'serverless',
]);

export const platformOptions = platformCategories
  .filter(({id}) => exposedPlatformCategoriesSet.has(id))
  .map(({name, platforms: platformKeys}) => ({
    label: name,
    options: [...platformKeys].map(platformKey => {
      const platform = platforms.find(p => p.id === platformKey);
      return {
        value: platformKey,
        label: platform?.name ?? platformKey,
      };
    }),
  }));

export const PLATFORMCHOICES = platformOptions
  .flatMap(platformChoice => platformChoice.options)
  .map(option => [option.value, option.label]);

export const PRODUCTCHOICES = [
  ['errors', 'Errors'],
  ['spans', 'Spans'],
  ['replays', 'Replays'],
  ['profiling', 'Profiling'],
  ['crons', 'Crons'],
] as const;

export const TRIALCHOICES = [
  ['trialing', 'Trialing'],
  ['can_trial', 'Can Trial'],
  ['has_trialed', 'Has Trialed'],
] as const;

export const ROLECHOICES = [
  ['admin', 'Admin'],
  ['billing', 'Billing'],
  ['manager', 'Manager'],
  ['member', 'Member'],
  ['owner', 'Owner'],
] as const;

export const PLANCHOICES = [
  ['paid_non_business', 'Paid Non-Business/Enterprise'],
  ['free', 'Free'],
  ['business', 'Business'],
] as const;

/**
 * Category of the broadcast.
 * Synced with https://github.com/getsentry/sentry/blob/master/src/sentry/models/broadcast.py#L14
 */
export const CATEGORYCHOICES = [
  ['announcement', 'Announcement'],
  ['feature', 'New Feature'],
  ['blog', 'Blog Post'],
  ['event', 'Event'],
  ['video', 'Video'],
] as const;
