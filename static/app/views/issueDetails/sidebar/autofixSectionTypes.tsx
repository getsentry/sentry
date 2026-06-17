import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import type {useAiConfig} from 'sentry/views/issueDetails/hooks/useAiConfig';

export interface AutofixContentProps {
  aiConfig: ReturnType<typeof useAiConfig>;
  group: Group;
  project: Project;
  event?: Event;
}
