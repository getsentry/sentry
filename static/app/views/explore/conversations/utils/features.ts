import type {Organization} from 'sentry/types/organization';

export function hasGenAiConversationsFeature(organization: Organization) {
  return organization.features.includes('gen-ai-conversations');
}
