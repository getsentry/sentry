import {Button} from '@sentry/scraps/button';

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
      data-stacktrace-interactive="true"
      onClick={() => toggleHiddenFrames()}
    >
      {hiddenFramesExpanded
        ? t('Hide %s frames', hiddenFrameCount)
        : t('Show %s more frames', hiddenFrameCount)}
    </Button>
  );
}
