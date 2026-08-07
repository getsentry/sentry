import {Tooltip} from '@sentry/scraps/tooltip';

import {useNativeStackTraceContext} from 'sentry/components/stackTrace/native/nativeStackTraceContext';
import {useStackTraceFrameContext} from 'sentry/components/stackTrace/stackTraceContext';
import {IconFileBroken} from 'sentry/icons/iconFileBroken';
import {IconWarning} from 'sentry/icons/iconWarning';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';

import {
  getSymbolicatorStatus,
  type SymbolicatorIconStatus,
} from './getSymbolicatorStatus';

function getStatusIconConfig(status: NonNullable<SymbolicatorIconStatus>): {
  Icon: React.ComponentType<SVGIconProps>;
  testId: string;
  title: string;
  variant: SVGIconProps['variant'];
} {
  switch (status) {
    case 'error':
      return {
        Icon: IconFileBroken,
        testId: 'symbolication-error-icon',
        title: t('This frame has missing debug files and could not be symbolicated'),
        variant: 'danger',
      };
    case 'warning':
      return {
        Icon: IconWarning,
        testId: 'symbolication-warning-icon',
        title: t('This frame has an unknown problem and could not be symbolicated'),
        variant: 'warning',
      };
  }
}

export function SymbolicatorStatusIcon() {
  const {frame, frameIndex} = useStackTraceFrameContext();
  const {imageByFrameIndex} = useNativeStackTraceContext();
  const image = imageByFrameIndex.get(frameIndex) ?? null;
  const status = getSymbolicatorStatus(frame, image);

  if (status === null) {
    return null;
  }

  const {Icon, testId, title, variant} = getStatusIconConfig(status);

  return (
    <Tooltip title={title} skipWrapper>
      <Icon size="sm" variant={variant} data-test-id={testId} />
    </Tooltip>
  );
}
