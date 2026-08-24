import styled from '@emotion/styled';

import {NoteInputWithStorage} from 'sentry/components/activity/note/inputWithStorage';

export function ActivityNoteInput(
  props: React.ComponentProps<typeof NoteInputWithStorage>
) {
  return (
    <ActivityInputFrame>
      <NoteInputWithStorage {...props} />
    </ActivityInputFrame>
  );
}

export function ActivityInputFrame({children}: React.PropsWithChildren) {
  return <Frame data-test-id="activity-input-frame">{children}</Frame>;
}

const Frame = styled('div')`
  color: ${p => p.theme.tokens.content.primary};
  container-type: inline-size;
  min-width: 0;
`;
