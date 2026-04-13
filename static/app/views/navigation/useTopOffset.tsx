import {SUPERUSER_MARQUEE_HEIGHT} from 'sentry/views/navigation/constants';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';
import {useShowSuperuserWarning} from 'sentry/views/navigation/useShowSuperuserWarning';

export function useTopOffset() {
  const hasPageFrame = useHasPageFrameFeature();
  const showSuperuserWarning = useShowSuperuserWarning();

  if (!hasPageFrame) {
    return '0px';
  }

  if (showSuperuserWarning) {
    return `${SUPERUSER_MARQUEE_HEIGHT}px`;
  }

  return '0px';
}
