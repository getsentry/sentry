import type {Organization} from 'sentry/types/organization';

export function hasGenAiConversationsFeature(organization: Organization) {
  return organization.features.includes('gen-ai-conversations');
}

export function hasBackendConversationTranscriptFeature(organization: Organization) {
  return organization.features.includes('gen-ai-conversations-backend-transcript');
}
