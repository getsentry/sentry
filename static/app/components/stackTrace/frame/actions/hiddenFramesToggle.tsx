import {Button} from '@sentry/scraps/button';
import {Text} from '@sentry/scraps/text';

import {useStackTraceFrameContext} from 'sentry/components/stackTrace/stackTraceContext';
import {t} from 'sentry/locale';

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
          ? t('Hide %s frames', hiddenFrameCount)
          : t('Show %s more frames', hiddenFrameCount)}
      </Text>
    </Button>
  );
}
