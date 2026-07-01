import styled from '@emotion/styled';

import {NoteInputWithStorage} from 'sentry/components/activity/note/inputWithStorage';

export function ActivityNoteInput(
  props: React.ComponentProps<typeof NoteInputWithStorage>
) {
  return (
    <ActivityInputFrame data-test-id="activity-input-frame">
      <NoteInputWithStorage {...props} />
    </ActivityInputFrame>
  );
}

const ActivityInputFrame = styled('div')`
  color: ${p => p.theme.tokens.content.primary};
  min-width: 0;
`;
