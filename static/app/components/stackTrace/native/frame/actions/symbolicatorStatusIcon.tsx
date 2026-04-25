import {Tooltip} from '@sentry/scraps/tooltip';

import {useNativeStackTraceContext} from 'sentry/components/stackTrace/native/nativeStackTraceContext';
import {useStackTraceFrameContext} from 'sentry/components/stackTrace/stackTraceContext';
import {IconFileBroken} from 'sentry/icons/iconFileBroken';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t} from 'sentry/locale';

import {getSymbolicatorStatus} from './getSymbolicatorStatus';

export function SymbolicatorStatusIcon() {
  const {frame, frameIndex} = useStackTraceFrameContext();
  const {imageByFrameIndex} = useNativeStackTraceContext();
  const image = imageByFrameIndex.get(frameIndex) ?? null;
  const status = getSymbolicatorStatus(frame, image);

  if (status === 'error') {
    return (
      <Tooltip
        title={t('This frame has missing debug files and could not be symbolicated')}
        skipWrapper
      >
        <IconFileBroken
          size="sm"
          variant="danger"
          data-test-id="symbolication-error-icon"
        />
      </Tooltip>
    );
  }

  if (status === 'warning') {
    return (
      <Tooltip
        title={t('This frame has an unknown problem and could not be symbolicated')}
        skipWrapper
      >
        <IconWarning
          size="sm"
          variant="warning"
          data-test-id="symbolication-warning-icon"
        />
      </Tooltip>
    );
  }

  return null;
}
