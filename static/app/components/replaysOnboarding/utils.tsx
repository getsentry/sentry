import {replayFrontendPlatforms} from 'sentry/data/platformCategories';
import platforms from 'sentry/data/platforms';
import type {PlatformIntegration} from 'sentry/types/project';

export const replayJsFrameworkOptions: PlatformIntegration[] = platforms.filter(p =>
  replayFrontendPlatforms.includes(p.id)
);
