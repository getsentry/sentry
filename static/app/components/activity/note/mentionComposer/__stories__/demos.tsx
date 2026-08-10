import {Stack} from '@sentry/scraps/layout';

import {MentionComposer} from 'sentry/components/activity/note/mentionComposer/mentionComposer';

export function MentionComposerDemo() {
  return (
    <Stack width="100%" maxWidth="720px">
      <MentionComposer />
    </Stack>
  );
}
