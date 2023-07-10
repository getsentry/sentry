import integrationDocsPlatforms from 'integration-docs-platforms';
import sortBy from 'lodash/sortBy';

import {migratedDocs} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {t} from 'sentry/locale';
import {PlatformIntegration} from 'sentry/types';

import {tracing} from './platformCategories';

const migratedJavascriptPlatforms = {
  id: 'javascript',
  name: 'Browser JavaScript',
  integrations: [
    ...(integrationDocsPlatforms.platforms
      .filter(platform => platform.id === 'javascript')?.[0]
      ?.integrations?.filter(integration => !migratedDocs.includes(integration.id)) ??
      []),
    {
      id: 'javascript-react',
      link: 'https://docs.sentry.io/platforms/javascript/guides/react/',
      name: 'React',
      type: 'framework',
    },
    {
      id: 'javascript-remix',
      link: 'https://docs.sentry.io/platforms/javascript/guides/remix/',
      name: 'Remix',
      type: 'framework',
    },
    {
      id: 'javascript-angular',
      link: 'https://docs.sentry.io/platforms/javascript/guides/angular/',
      name: 'Angular',
      type: 'framework',
    },
    {
      id: 'javascript-vue',
      link: 'https://docs.sentry.io/platforms/javascript/guides/vue/',
      name: 'Vue',
      type: 'framework',
    },
  ],
};

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
  ...(integrationDocsPlatforms.platforms.filter(
    platform => platform.id !== 'javascript'
  ) ?? []),
  migratedJavascriptPlatforms,
  otherPlatform,
]
  .map(platform => {
    const integrations = platform.integrations.reduce((acc, value) => {
      // filter out any javascript-[angular|angularjs|ember|gatsby|nextjs|react|remix|svelte|sveltekit|vue]-* platforms; as they're not meant to be used as a platform in the PlatformPicker component
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
