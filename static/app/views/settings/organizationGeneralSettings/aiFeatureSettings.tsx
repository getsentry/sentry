import type {Organization} from 'sentry/types/organization';

export const defaultEnableSeerFeaturesValue = (organization: Organization) => {
  const isBaa = false; // TODO: add check here once we have a way to check if the org is a BAA customer. Leave it as false for now.
  return !organization.hideAiFeatures && !isBaa;
};
