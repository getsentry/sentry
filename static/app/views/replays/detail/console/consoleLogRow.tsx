import type {CSSProperties} from 'react';
import {useCallback} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import type {AlertProps} from '@sentry/scraps/alert';

import {Tooltip} from 'sentry/components/core/tooltip';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {IconClose, IconInfo, IconWarning} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {BreadcrumbLevelType} from 'sentry/types/breadcrumbs';
import type useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import type {BreadcrumbFrame, ConsoleFrame} from 'sentry/utils/replays/types';
import MessageFormatter from 'sentry/views/replays/detail/console/messageFormatter';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';

interface Props extends ReturnType<typeof useCrumbHandlers> {
  currentHoverTime: number | undefined;
  currentTime: number;
  frame: BreadcrumbFrame;
  index: number;
  onDimensionChange: (
    index: number,
    path: string,
    expandedState: Record<string, boolean>
  ) => void;
  startTimestampMs: number;
  style: CSSProperties;
  expandPaths?: string[];
  ref?: React.Ref<HTMLDivElement>;
}

function ConsoleLogRow({
  currentHoverTime,
  currentTime,
  expandPaths,
  frame,
  onMouseEnter,
  onMouseLeave,
  index,
  onClickTimestamp,
  onDimensionChange,
  startTimestampMs,
  style,
  ref,
}: Props) {
  const handleDimensionChange = useCallback(
    (path: any, expandedState: any) => onDimensionChange?.(index, path, expandedState),
    [onDimensionChange, index]
  );

  const hasOccurred = currentTime >= frame.offsetMs;
  const isBeforeHover =
    currentHoverTime === undefined || currentHoverTime >= frame.offsetMs;

  return (
    <ConsoleLog
      ref={ref}
      className={classNames({
        beforeCurrentTime: hasOccurred,
        afterCurrentTime: !hasOccurred,
        beforeHoverTime: currentHoverTime !== undefined && isBeforeHover,
        afterHoverTime: currentHoverTime !== undefined && !isBeforeHover,
      })}
      hasOccurred={hasOccurred}
      level={(frame as ConsoleFrame).level}
      onMouseEnter={() => onMouseEnter(frame)}
      onMouseLeave={() => onMouseLeave(frame)}
      style={style}
    >
      <ConsoleLevelIcon level={(frame as ConsoleFrame).level} />
      <Message>
        <ErrorBoundary mini>
          <MessageFormatter
            expandPaths={expandPaths}
            frame={frame}
            onExpand={handleDimensionChange}
          />
        </ErrorBoundary>
      </Message>
      <TimestampButton
        onClick={event => {
          event.stopPropagation();
          onClickTimestamp(frame);
        }}
        startTimestampMs={startTimestampMs}
        timestampMs={frame.timestampMs}
      />
    </ConsoleLog>
  );
}

export default ConsoleLogRow;

function levelToAlertVariant(level: string | undefined): AlertProps['variant'] {
  switch (level) {
    case 'error':
    case 'fatal':
      return 'danger';

    case 'warning':
      return 'warning';

    case 'info':
    case 'debug':
    case 'log':
    case 'undefined':
    case undefined:
    default:
      return 'info';
  }
}

const ConsoleLog = styled('div')<{
  hasOccurred: boolean;
  level: undefined | string;
}>`
  display: grid;
  grid-template-columns: 12px 1fr max-content;
  gap: ${space(0.75)};
  align-items: baseline;
  padding: ${space(0.5)} ${space(1)};
  font-size: ${p => p.theme.fontSize.sm};

  background-color: ${p =>
    p.level === 'warning' || p.level === 'error'
      ? p.theme.alert[levelToAlertVariant(p.level)].backgroundLight
      : 'inherit'};

  color: ${p => p.theme.colors.gray500};

  /*
  Show the timestamp button "Play" icon when we hover the row.
  This is a really generic selector that could find many things, but for now it
  only targets the one thing that we expect.
  */
  &:hover button > svg {
    visibility: visible;
  }
`;

const ICONS = {
  [BreadcrumbLevelType.ERROR]: (
    <Tooltip title={BreadcrumbLevelType.ERROR}>
      <IconClose size="xs" color="red400" />
    </Tooltip>
  ),
  [BreadcrumbLevelType.WARNING]: (
    <Tooltip title={BreadcrumbLevelType.WARNING}>
      <IconWarning color="yellow400" size="xs" />
    </Tooltip>
  ),
  [BreadcrumbLevelType.INFO]: (
    <Tooltip title={BreadcrumbLevelType.INFO}>
      <IconInfo color="gray400" size="xs" />
    </Tooltip>
  ),
};

const MediumFontSize = styled('span')`
  font-size: ${p => p.theme.fontSize.md};
`;

function ConsoleLevelIcon({level}: {level: string | undefined}) {
  return level && level in ICONS ? (
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    <MediumFontSize>{ICONS[level]}</MediumFontSize>
  ) : (
    <i />
  );
}

const Message = styled('div')`
  font-family: ${p => p.theme.text.familyMono};

  white-space: pre-wrap;
  word-break: break-word;
`;
