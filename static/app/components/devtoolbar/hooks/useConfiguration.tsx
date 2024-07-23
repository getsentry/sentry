import {createContext, useContext} from 'react';

import type {Configuration} from '../types';

const context = createContext<Configuration>({
  apiPrefix: '',
  environment: ['production'],
  organizationSlug: '',
  placement: 'right-edge',
  projectId: 0,
  projectSlug: '',
  featureFlags: [],
  featureFlagTemplateUrl: _flag => '',
});

export function ConfigurationContextProvider({
  children,
  config,
}: {
  children: React.ReactNode;
  config: Configuration;
}) {
  return <context.Provider value={config}>{children}</context.Provider>;
}

export default function useConfiguration() {
  return useContext(context);
}
