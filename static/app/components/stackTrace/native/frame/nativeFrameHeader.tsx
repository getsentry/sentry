import {useState} from 'react';
import styled from '@emotion/styled';

import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {getLeadHint, trimPackage} from 'sentry/components/events/interfaces/frame/utils';
import {useNativeStackTraceContext} from 'sentry/components/stackTrace/native/nativeStackTraceContext';
import {useStackTraceFrameContext} from 'sentry/components/stackTrace/stackTraceContext';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';

import {isDartAsyncSuspension} from './actions/getSymbolicatorStatus';
import {NativeDefaultActions} from './actions/nativeDefaultActions';
import {SymbolicatorStatusIcon} from './actions/symbolicatorStatusIcon';
import {NativeFrameAddress} from './nativeFrameAddress';

interface NativeFrameHeaderProps {
  /** Custom trailing actions; falls back to NativeDefaultActions. */
  actions?: React.ReactNode | ((props: {isHovering: boolean}) => React.ReactNode);
}

function getFunctionLabel({
  frame,
  verboseFunctionNames,
}: {
  frame: ReturnType<typeof useStackTraceFrameContext>['frame'];
  verboseFunctionNames: boolean;
}) {
  if (verboseFunctionNames && frame.rawFunction) {
    return frame.rawFunction;
  }
  return frame.function ?? frame.rawFunction ?? null;
}

export function NativeFrameHeader({actions}: NativeFrameHeaderProps) {
  const {
    event,
    frame,
    frameContextId,
    isExpandable,
    isExpanded,
    nextFrame,
    toggleExpansion,
  } = useStackTraceFrameContext();
  const {absoluteFilePaths, hasAnyStatusIcons, verboseFunctionNames} =
    useNativeStackTraceContext();
  const [isHovering, setIsHovering] = useState(false);

  const isDartAsync = isDartAsyncSuspension(frame);
  const functionLabel = getFunctionLabel({frame, verboseFunctionNames});
  const packageLabel = frame.package ? trimPackage(frame.package) : null;
  const leadsToApp = !frame.inApp && (nextFrame?.inApp || !nextFrame);

  const resolvedActions =
    typeof actions === 'function'
      ? actions({isHovering})
      : (actions ?? <NativeDefaultActions />);

  return (
    <HeaderGrid
      data-test-id="native-stack-trace-frame-title"
      isExpandable={isExpandable}
      hasStatusColumn={hasAnyStatusIcons}
      aria-expanded={isExpandable ? isExpanded : undefined}
      aria-controls={isExpandable ? frameContextId : undefined}
      onClick={() => {
        const selectedText = window.getSelection()?.toString();
        if (isExpandable && !selectedText) {
          toggleExpansion();
        }
      }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {hasAnyStatusIcons ? (
        <StatusCell data-test-id="native-stack-trace-status-cell">
          <SymbolicatorStatusIcon />
        </StatusCell>
      ) : null}

      <PackageCell>
        {leadsToApp ? (
          <LeadHint>
            <Text as="span" size="xs" variant="muted">
              {getLeadHint({event, hasNextFrame: defined(nextFrame)})}
            </Text>
          </LeadHint>
        ) : null}
        <Tooltip
          title={
            frame.package ??
            (isDartAsync ? t('Dart async operation') : t('Go to images loaded'))
          }
          maxWidth={400}
          delay={1000}
          skipWrapper
        >
          <PackageLabel>
            {packageLabel ??
              (isDartAsync ? (
                t('Dart async')
              ) : (
                <Text as="span" variant="muted">
                  {t('<unknown>')}
                </Text>
              ))}
          </PackageLabel>
        </Tooltip>
      </PackageCell>

      <AddressCell>
        <NativeFrameAddress />
      </AddressCell>

      <FunctionCell>
        {functionLabel ? (
          <Tooltip
            title={frame.rawFunction ?? frame.symbol}
            disabled={!frame.rawFunction}
          >
            <FunctionName>{functionLabel}</FunctionName>
          </Tooltip>
        ) : isDartAsync ? (
          t('Dart')
        ) : (
          <Text variant="muted">{`<${t('unknown')}>`}</Text>
        )}
        {frame.filename ? (
          <Tooltip
            title={frame.absPath}
            disabled={!frame.absPath || frame.absPath === frame.filename}
            isHoverable
          >
            <FileName>
              <Text as="span" variant="muted" size="xs" monospace>
                {'('}
                {absoluteFilePaths ? (frame.absPath ?? frame.filename) : frame.filename}
                {frame.lineNo ? `:${frame.lineNo}` : ''}
                {')'}
              </Text>
            </FileName>
          </Tooltip>
        ) : null}
      </FunctionCell>

      <ActionsCell>{resolvedActions}</ActionsCell>
    </HeaderGrid>
  );
}

const HeaderGrid = styled('div')<{
  hasStatusColumn: boolean;
  isExpandable: boolean;
}>`
  display: grid;
  grid-template-columns: ${p =>
    p.hasStatusColumn
      ? '16px minmax(100px, 140px) minmax(64px, 88px) minmax(0, 1fr) auto'
      : 'minmax(100px, 140px) minmax(64px, 88px) minmax(0, 1fr) auto'};
  align-items: center;
  gap: ${p => p.theme.space.sm};
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.md};
  min-height: 36px;
  cursor: ${p => (p.isExpandable ? 'pointer' : 'default')};
  background: ${p => p.theme.tokens.background.secondary};
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.tokens.content.primary};
  text-align: left;

  &:hover {
    background: ${p => p.theme.tokens.background.tertiary};
  }

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: ${p =>
      p.hasStatusColumn ? '16px minmax(0, 1fr) auto' : 'minmax(0, 1fr) auto'};
    /* stylelint-disable-next-line named-grid-areas-no-invalid */
    grid-template-areas: ${p =>
      p.hasStatusColumn
        ? "'status package actions' 'status address actions' 'status function function'"
        : "'package actions' 'address actions' 'function function'"};
    row-gap: ${p => p.theme.space['2xs']};
  }
`;

const StatusCell = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    grid-area: status;
  }
`;

const PackageCell = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  min-width: 0;
  overflow: hidden;
  line-height: 1.4;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    grid-area: package;
  }
`;

const LeadHint = styled('span')`
  display: block;
  max-width: 100%;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const PackageLabel = styled('span')`
  display: block;
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const AddressCell = styled('div')`
  display: flex;
  align-items: center;
  min-width: 0;
  line-height: 1.4;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    grid-area: address;
  }
`;

const FunctionCell = styled('div')`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: ${p => p.theme.space.xs};
  row-gap: ${p => p.theme.space['2xs']};
  min-width: 0;
  word-break: break-all;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    grid-area: function;
  }
`;

const FunctionName = styled('span')`
  min-width: 0;
  flex: 0 1 auto;
  word-break: break-all;
`;

const FileName = styled('span')`
  border-bottom: 1px dashed ${p => p.theme.tokens.border.primary};
`;

const ActionsCell = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  margin-left: auto;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    grid-area: actions;
  }
`;
