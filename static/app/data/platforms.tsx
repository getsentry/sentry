import platforms from 'integration-docs-platforms';

import {t} from 'sentry/locale';
import {PlatformIntegration} from 'sentry/types';

import {tracing} from './platformCategories';

const otherPlatform = {
  integrations: [
    {
      link: 'https://docs.sentry.io/platforms/',
      type: 'language',
      id: 'other',
      name: t('Other'),
    },
  ],
  id: 'other',
  name: t('Other'),
};

export default ([] as PlatformIntegration[]).concat(
  [],
  ...[...platforms.platforms, otherPlatform].map(platform =>
    platform.integrations
      .map(i => ({...i, language: platform.id} as PlatformIntegration))
      // filter out any tracing platforms; as they're not meant to be used as a platform for
      // the project creation flow
      .filter(integration => !(tracing as readonly string[]).includes(integration.id))
      // filter out any performance onboarding documentation
      .filter(integration => !integration.id.includes('performance-onboarding'))
  )
);
