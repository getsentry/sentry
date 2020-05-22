import {Organization} from 'app/types';

export type ProviderType = 'sentryapp' | 'plugin' | 'integration';
export type RequestIntegrationProps = {
  organization: Organization;
  name: string;
  slug: string;
  type: ProviderType;
};
