import integrationDocsPlatforms from 'integration-docs-platforms';
import sortBy from 'lodash/sortBy';

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

const platformIntegrations: PlatformIntegration[] = [
  ...integrationDocsPlatforms.platforms,
  otherPlatform,
]
  .map(platform => {
    const integrations = platform.integrations
      .map(i => ({...i, language: platform.id} as PlatformIntegration))
      // filter out any tracing platforms; as they're not meant to be used as a platform for
      // the project creation flow
      .filter(integration => !(tracing as readonly string[]).includes(integration.id))
      // filter out any performance onboarding documentation
      .filter(integration => !integration.id.includes('performance-onboarding'))
      // filter out any replay onboarding documentation
      .filter(integration => !integration.id.includes('replay-onboarding'))
      // filter out any profiling onboarding documentation
      .filter(integration => !integration.id.includes('profiling-onboarding'));

    return integrations;
  })
  .flat();

const platforms = sortBy(platformIntegrations, 'id');

export default platforms;
