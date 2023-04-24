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
    const integrations = platform.integrations.reduce((acc, value) => {
      // filter out any javascript-[angular|angularjs|ember|gatsby|nextjs|react|remix|svelte|vue]-* platforms; as they're not meant to be used as a platform in the PlatformPicker component
      if (value.id.match('^javascript-([A-Za-z]+)-([a-zA-Z0-9]+.*)$')) {
        return acc;
      }

      // filter out any tracing platforms; as they're not meant to be used as a platform for
      // the project creation flow
      if ((tracing as readonly string[]).includes(value.id)) {
        return acc;
      }

      // filter out any performance onboarding documentation
      if (value.id.includes('performance-onboarding')) {
        return acc;
      }

      // filter out any replay onboarding documentation
      if (value.id.includes('replay-onboarding')) {
        return acc;
      }

      // filter out any profiling onboarding documentation
      if (value.id.includes('profiling-onboarding')) {
        return acc;
      }

      if (!acc[value.id]) {
        acc[value.id] = {...value, language: platform.id};
        return acc;
      }

      return acc;
    }, {});

    return Object.values(integrations) as PlatformIntegration[];
  })
  .flat();

const platforms = sortBy(platformIntegrations, 'id');

export default platforms;
