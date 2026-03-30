import {Button} from '@sentry/scraps/button';
import {Text} from '@sentry/scraps/text';

import {useStackTraceFrameContext} from 'sentry/components/stackTrace/stackTraceContext';
import {tn} from 'sentry/locale';

export function HiddenFramesToggleAction() {
  const {hiddenFrameCount, hiddenFramesExpanded, toggleHiddenFrames} =
    useStackTraceFrameContext();

  if (!hiddenFrameCount) {
    return null;
  }

  return (
    <Button
      size="zero"
      priority="transparent"
      onClick={e => {
        e.stopPropagation();
        toggleHiddenFrames();
      }}
    >
      <Text variant="muted">
        {hiddenFramesExpanded
          ? tn('Hide %s frame', 'Hide %s frames', hiddenFrameCount)
          : tn('Show %s more frame', 'Show %s more frames', hiddenFrameCount)}
      </Text>
    </Button>
  );
}
