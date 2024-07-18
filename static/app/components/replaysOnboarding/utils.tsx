import {replayFrontendPlatforms} from 'sentry/data/platformCategories';
import platforms from 'sentry/data/platforms';
import type {PlatformIntegration} from 'sentry/types/project';

export function replayJsFrameworkOptions(): PlatformIntegration[] {
  const frameworks = platforms.filter(p => replayFrontendPlatforms.includes(p.id));
  const jsPlatformIdx = frameworks.findIndex(p => p.id === 'javascript');
  const jsPlatform = frameworks[jsPlatformIdx];
  frameworks.splice(jsPlatformIdx, 1);
  frameworks.unshift(jsPlatform);
  return frameworks;
}
