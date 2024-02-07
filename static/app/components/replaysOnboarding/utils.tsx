import partition from 'lodash/partition';

import Alert from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {replayFrontendPlatforms, replayPlatforms} from 'sentry/data/platformCategories';
import platforms from 'sentry/data/platforms';
import {tct} from 'sentry/locale';
import type {PlatformIntegration, PlatformKey, Project} from 'sentry/types';

export function generateDocKeys(platform: PlatformKey): string[] {
  const platformKey = platform.startsWith('javascript')
    ? platform
    : 'javascript-' + platform;
  return ['1-install', '2-configure'].map(
    key => `${platformKey}-replay-onboarding-${key}`
  );
}

export function isPlatformSupported(platform: undefined | PlatformIntegration) {
  return platform?.id ? replayPlatforms.includes(platform?.id) : false;
}

export function splitProjectsByReplaySupport(projects: Project[]) {
  const [supported, unsupported] = partition(projects, project =>
    replayPlatforms.includes(project.platform!)
  );
  return {
    supported,
    unsupported,
  };
}

export const replayJsFrameworkOptions: PlatformIntegration[] = platforms.filter(p =>
  replayFrontendPlatforms.includes(p.id)
);

export const tracePropagationMessage = (
  <Alert type="info" showIcon>
    {tct(
      `To see replays for backend errors, ensure that you have set up trace propagation. To learn more, [link:read the docs].`,
      {
        link: (
          <ExternalLink href="https://docs.sentry.io/product/session-replay/getting-started/#replays-for-backend-errors/" />
        ),
      }
    )}
  </Alert>
);
