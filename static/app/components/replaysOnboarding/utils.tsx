import {replayFrontendPlatforms} from 'sentry/data/platformCategories';
import platforms from 'sentry/data/platforms';
import type {PlatformIntegration} from 'sentry/types/project';

export function replayJsFrameworkOptions(): PlatformIntegration[] {
  // the platforms array is sorted alphabetically, but we want javascript to be
  // at the front so that it shows up by default in the onboarding.
  const frameworks = platforms.filter(p => replayFrontendPlatforms.includes(p.id));
  const jsPlatformIdx = frameworks.findIndex(p => p.id === 'javascript');
  const jsPlatform = frameworks[jsPlatformIdx]!;

  // move javascript to the front
  frameworks.splice(jsPlatformIdx, 1);
  frameworks.unshift(jsPlatform);
  return frameworks;
}
