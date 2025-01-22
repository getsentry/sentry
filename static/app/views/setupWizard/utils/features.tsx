import type {Organization} from 'sentry/types/organization';

export function hasSetupWizardCreateProjectFeature(organization: Organization) {
  return organization.features.includes('setup-wizard-create-project');
}
