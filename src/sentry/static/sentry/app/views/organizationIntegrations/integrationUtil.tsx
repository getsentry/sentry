const pluginMapping = {
  id: 'id',
  name: 'name',
};

const providerMapping = {
  id: 'key',
  name: 'name',
};

const sentryAppMapping = {
  id: 'slug',
  name: 'name',
};

const getMapping = type => {
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

export const mapped = (integration, type) => {
  const mapping = getMapping(type);
  const result = {};

  for (const [key, value] of Object.entries(mapping) as [string, string][]) {
    result[key] = integration[value];
  }
  return result;
};
