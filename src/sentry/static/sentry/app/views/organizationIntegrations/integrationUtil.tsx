import {SentryApp, IntegrationProvider, PluginWithProjectList} from 'app/types';

type AppOrProviderOrPlugin = SentryApp | IntegrationProvider | PluginWithProjectList;

const pluginMapping = {
  slug: 'id',
  name: 'name',
};

const providerMapping = {
  slug: 'key',
  name: 'name',
};

const sentryAppMapping = {
  slug: 'slug',
  name: 'name',
};

type integrationTypes = 'plugin' | 'sentry-app' | 'provider';

const getMapping = (type: integrationTypes) => {
  switch (type) {
    case 'plugin':
      return pluginMapping;
    case 'sentry-app':
      return sentryAppMapping;
    case 'provider':
      return providerMapping;
    default:
      return {};
  }
};

export const mapped = (integration: AppOrProviderOrPlugin) => (
  type: integrationTypes
) => (field: string): string => integration[getMapping(type)[field]];
