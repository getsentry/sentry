import {Container, Stack} from '@sentry/scraps/layout';

import {GroupSummary} from 'sentry/components/group/groupSummary';
import HookOrDefault from 'sentry/components/hookOrDefault';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';

const AiSetupDataConsent = HookOrDefault({
  hookName: 'component:ai-setup-data-consent',
  defaultComponent: () => <div data-test-id="ai-setup-data-consent" />,
});

export function SeerWelcomeScreen({
  group,
  project,
  event,
}: {
  event: Event;
  group: Group;
  project: Project;
}) {
  return (
    <Stack gap="2xl">
      <Container background="primary" border="primary" radius="md" padding="xl">
        <GroupSummary group={group} event={event} project={project} />
      </Container>
      <AiSetupDataConsent groupId={group.id} />
    </Stack>
  );
}
