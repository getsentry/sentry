import {createContext, useContext} from 'react';

import type {Configuration} from '../types';

const context = createContext<Configuration>({
  apiPrefix: '',
  environment: ['production'],
  featureFlags: {},
  organizationSlug: '',
  placement: 'right-edge',
  projectId: 0,
  projectPlatform: '',
  projectSlug: '',
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
