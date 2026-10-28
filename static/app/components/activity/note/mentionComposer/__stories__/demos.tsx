import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {MentionComposer} from 'sentry/components/activity/note/mentionComposer/mentionComposer';
import {useProjects} from 'sentry/utils/useProjects';

export function AssigneeSelectorMentionComposerDemo() {
  const {projects, fetching} = useProjects();
  const project = projects.find(candidate => candidate.isMember) ?? projects[0];

  if (!project) {
    return (
      <Text as="p" variant="muted">
        {fetching ? 'Loading projects…' : 'Join a project to try this demo.'}
      </Text>
    );
  }

  return (
    <Stack width="100%" maxWidth="720px" gap="sm">
      <MentionComposer
        mode="create"
        assigneeSelector={{project}}
        onSubmit={() => Promise.resolve()}
      />
      <Text as="p" size="sm" variant="muted">
        Members and teams come from {project.slug}.
      </Text>
    </Stack>
  );
}
