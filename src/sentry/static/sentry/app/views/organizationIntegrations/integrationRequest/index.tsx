import {IntegrationType, Organization} from 'app/types';

export type RequestIntegrationProps = {
  organization: Organization;
  name: string;
  slug: string;
  type: IntegrationType;
};
