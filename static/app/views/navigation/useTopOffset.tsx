import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';
import {useShowSuperuserWarning} from 'sentry/views/navigation/useShowSuperuserWarning';

export function useTopOffset() {
  const hasPageFrame = useHasPageFrameFeature();
  const showSuperuserWarning = useShowSuperuserWarning();

  if (!hasPageFrame) {
    return '0px';
  }

  if (showSuperuserWarning) {
    return '24px';
  }

  return '0px';
}
