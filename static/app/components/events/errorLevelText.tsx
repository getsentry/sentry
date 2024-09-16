import styled from '@emotion/styled';

import {IconClose, IconFatal, IconInfo, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Level} from 'sentry/types/event';
import type {IconSize} from 'sentry/utils/theme';

const errorLevelMap: Readonly<Record<Level, string>> = {
  error: t('Error'),
  fatal: t('Fatal'),
  info: t('Info'),
  warning: t('Warning'),
  sample: t('Sample'),
  unknown: t('Unknown'),
};

interface IconWithDefaultProps {
  Component: React.ComponentType<any> | null;
  defaultProps: {isCircled?: boolean};
}

const errorLevelIconMap: Readonly<Record<Level, IconWithDefaultProps>> = {
  error: {Component: IconClose, defaultProps: {isCircled: true}},
  fatal: {Component: IconFatal, defaultProps: {}},
  info: {Component: IconInfo, defaultProps: {}},
  warning: {Component: IconWarning, defaultProps: {}},
  sample: {Component: null, defaultProps: {}},
  unknown: {Component: null, defaultProps: {}},
};

interface ErrorLevelTextProps {
  level: Level;
  iconSize?: IconSize;
}

export function ErrorLevelText({level, iconSize = 'xs'}: ErrorLevelTextProps) {
  const Icon = errorLevelIconMap[level]?.Component ?? null;
  return (
    <ErrorLevelTextWrapper>
      {Icon && (
        <Icon
          {...errorLevelIconMap[level].defaultProps}
          size={iconSize}
          color="subText"
        />
      )}
      {errorLevelMap[level]}
    </ErrorLevelTextWrapper>
  );
}

const ErrorLevelTextWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;
