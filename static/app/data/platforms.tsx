import integrationDocsPlatforms from 'integration-docs-platforms';
import sortBy from 'lodash/sortBy';

import {t} from 'sentry/locale';
import {PlatformIntegration} from 'sentry/types';

import {tracing} from './platformCategories';

const goPlatforms = [
  {
    integrations: [
      ...(integrationDocsPlatforms.platforms.find(platform => platform.id === 'go')
        ?.integrations ?? []),
      {
        link: 'https://docs.sentry.io/platforms/go/guides/echo/',
        type: 'framework',
        id: 'go-echo',
        name: t('Echo'),
      },
      {
        link: 'https://docs.sentry.io/platforms/go/guides/fasthttp/',
        type: 'framework',
        id: 'go-fasthttp',
        name: t('FastHTTP'),
      },
      {
        link: 'https://docs.sentry.io/platforms/go/guides/gin/',
        type: 'framework',
        id: 'go-gin',
        name: t('Gin'),
      },
      {
        link: 'https://docs.sentry.io/platforms/go/guides/http/',
        type: 'framework',
        id: 'go-http',
        name: t('Net/Http'),
      },
      {
        link: 'https://docs.sentry.io/platforms/go/guides/iris',
        type: 'framework',
        id: 'go-iris',
        name: t('Iris'),
      },
      {
        link: 'https://docs.sentry.io/platforms/go/guides/martini/',
        type: 'framework',
        id: 'go-martini',
        name: t('Martini'),
      },
      {
        link: 'https://docs.sentry.io/platforms/go/guides/negroni/',
        type: 'framework',
        id: 'go-negroni',
        name: t('Negroni'),
      },
    ],
    id: 'go',
    name: t('Go'),
  },
];

const platformIntegrations: PlatformIntegration[] = [
  ...integrationDocsPlatforms.platforms.filter(platform => platform.id !== 'go'),
  ...goPlatforms,
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
