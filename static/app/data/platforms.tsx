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

export enum ReactDocVariant {
  ErrorMonitoring = 'javascript-react-with-error-monitoring',
  ErrorMonitoringAndPerformance = 'javascript-react-with-error-monitoring-and-performance',
  ErrorMonitoringAndSessionReplay = 'javascript-react-with-error-monitoring-and-replay',
  ErrorMonitoringPerformanceAndReplay = 'javascript-react-with-error-monitoring-performance-and-replay',
}

const platformIntegrations: PlatformIntegration[] = [
  ...integrationDocsPlatforms.platforms,
  otherPlatform,
]
  .map(platform => {
    const integrations = platform.integrations.reduce((acc, value) => {
      if (Object.values(ReactDocVariant).includes(value.id as ReactDocVariant)) {
        if (!acc['javascript-react']) {
          acc['javascript-react'] = {
            ...value,
            id: 'javascript-react',
            language: platform.id,
          };
        }
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
