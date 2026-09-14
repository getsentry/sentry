import {useState} from 'react';
import styled from '@emotion/styled';

import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {getLeadHint, trimPackage} from 'sentry/components/events/interfaces/frame/utils';
import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {useNativeDisplayOptionsContext} from 'sentry/components/stackTrace/native/nativeDisplayOptionsContext';
import {useNativeStackTraceContext} from 'sentry/components/stackTrace/native/nativeStackTraceContext';
import {
  useStackTraceContext,
  useStackTraceFrameContext,
  useStackTraceViewState,
} from 'sentry/components/stackTrace/stackTraceContext';
import type {StackTraceMeta} from 'sentry/components/stackTrace/types';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';

import {isDartAsyncSuspension} from './actions/getSymbolicatorStatus';
import {NativeDefaultActions} from './actions/nativeDefaultActions';
import {SymbolicatorStatusIcon} from './actions/symbolicatorStatusIcon';
import {NativeFrameAddress} from './nativeFrameAddress';

type FrameMeta = NonNullable<StackTraceMeta['frames']>[number];

interface NativeFrameHeaderProps {
  /** Custom trailing actions; falls back to NativeDefaultActions. */
  actions?: React.ReactNode | ((props: {isHovering: boolean}) => React.ReactNode);
}

const NATIVE_FRAME_COMPACT_BREAKPOINT = '650px';

function getFunctionLabel({
  frame,
  frameMeta,
  verboseFunctionNames,
}: {
  frame: ReturnType<typeof useStackTraceFrameContext>['frame'];
  frameMeta: FrameMeta | undefined;
  verboseFunctionNames: boolean;
}) {
  const functionNameHiddenDetails =
    defined(frame.rawFunction) &&
    defined(frame.function) &&
    frame.function !== frame.rawFunction;

  if (verboseFunctionNames && functionNameHiddenDetails && frame.rawFunction) {
    return {
      value: frame.rawFunction,
      meta: frameMeta?.rawFunction?.[''],
    };
  }

  if (frame.function) {
    return {
      value: frame.function,
      meta: frameMeta?.function?.[''],
    };
  }

  return null;
}

export function NativeFrameHeader({actions}: NativeFrameHeaderProps) {
  const {
    event,
    frame,
    frameIndex,
    isExpandable,
    isExpanded,
    isSubFrame,
    nextFrame,
    toggleExpansion,
  } = useStackTraceFrameContext();
  const {meta} = useStackTraceContext();
  const {view} = useStackTraceViewState();
  const {absoluteFilePaths, verboseFunctionNames} = useNativeDisplayOptionsContext();
  const {hasAnyStatusIcons} = useNativeStackTraceContext();
  const [isHovering, setIsHovering] = useState(false);

  const isDartAsync = isDartAsyncSuspension(frame);
  const frameMeta = meta?.frames?.[frameIndex];
  const functionLabel = getFunctionLabel({frame, frameMeta, verboseFunctionNames});
  const packageLabel = frame.package ? trimPackage(frame.package) : null;
  const leadsToApp = !frame.inApp && (nextFrame?.inApp || !nextFrame);
  const showLeadHint = view === 'app' && !isExpanded && leadsToApp;

  const resolvedActions =
    typeof actions === 'function'
      ? actions({isHovering})
      : (actions ?? <NativeDefaultActions />);

  return (
    <HeaderContainer>
      <HeaderGrid
        align="center"
        gap="sm md"
        data-test-id="native-stack-trace-frame-title"
        data-sub-frame={isSubFrame ? true : undefined}
        isExpandable={isExpandable}
        isInAppFrame={frame.inApp}
        isSubFrame={isSubFrame}
        hasStatusColumn={hasAnyStatusIcons}
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
          <StatusCell
            align="center"
            justify="center"
            data-test-id="native-stack-trace-status-cell"
          >
            <SymbolicatorStatusIcon />
          </StatusCell>
        ) : null}

        <PackageCell
          direction="column"
          align="start"
          justify="center"
          minWidth={0}
          overflow="hidden"
        >
          {showLeadHint ? (
            <LeadHint size="xs" variant="muted" ellipsis>
              {getLeadHint({event, hasNextFrame: defined(nextFrame)})}
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
            <PackageLabel variant="inherit" ellipsis>
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

        <AddressCell align="center" minWidth={0}>
          <NativeFrameAddress />
        </AddressCell>

        <FunctionCell wrap="wrap" align="baseline" gap="2xs xs" minWidth={0}>
          {functionLabel ? (
            <Tooltip
              title={frame.rawFunction ?? frame.symbol}
              disabled={!frame.rawFunction}
            >
              <FunctionName value={functionLabel.value} meta={functionLabel.meta} />
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
            >
              <FileName size="sm" variant="muted">
                {'('}
                {absoluteFilePaths ? (frame.absPath ?? frame.filename) : frame.filename}
                {frame.lineNo ? `:${frame.lineNo}` : ''}
                {')'}
              </FileName>
            </Tooltip>
          ) : null}
        </FunctionCell>

        <ActionsCell align="center" justify="end" gap="xs" justifySelf="end">
          {resolvedActions}
        </ActionsCell>
      </HeaderGrid>
    </HeaderContainer>
  );
}

const HeaderContainer = styled(Container)`
  container: native-frame-header / inline-size;
`;

const HeaderGrid = styled(Grid)<{
  hasStatusColumn: boolean;
  isExpandable: boolean;
  isInAppFrame: boolean;
  isSubFrame: boolean;
}>`
  grid-template-columns: ${p =>
    p.hasStatusColumn
      ? '16px 150px 120px minmax(0, 1fr) minmax(168px, auto)'
      : '150px 120px minmax(0, 1fr) minmax(168px, auto)'};
  padding: ${p =>
    `${p.theme.space.xs} ${p.theme.space.md} ${p.theme.space.xs} ${
      p.hasStatusColumn
        ? p.theme.space.md
        : `calc(${p.theme.space.md} + 16px + ${p.theme.space.md})`
    }`};
  min-height: 32px;
  cursor: ${p => (p.isExpandable ? 'pointer' : 'default')};
  background: ${p =>
    !p.isInAppFrame && p.isSubFrame
      ? p.theme.colors.surface200
      : p.theme.tokens.background.secondary};
  font-size: ${p => p.theme.font.size.sm};
  color: ${p =>
    p.isInAppFrame ? p.theme.tokens.content.primary : p.theme.tokens.content.secondary};
  font-style: ${p => (p.isInAppFrame ? 'normal' : 'italic')};
  text-align: left;

  &:hover {
    background: ${p => p.theme.tokens.background.tertiary};
  }

  @container native-frame-header (max-width: ${NATIVE_FRAME_COMPACT_BREAKPOINT}) {
    grid-template-columns: ${p =>
      p.hasStatusColumn
        ? '16px minmax(0, 72px) minmax(0, 1fr) auto'
        : 'minmax(0, 72px) minmax(0, 1fr) auto'};
    /* stylelint-disable-next-line named-grid-areas-no-invalid */
    grid-template-areas: ${p =>
      p.hasStatusColumn
        ? "'status address package actions' 'status function function function'"
        : "'address package actions' 'function function function'"};
    row-gap: ${p => p.theme.space['2xs']};
  }
`;

const StatusCell = styled(Flex)`
  @container native-frame-header (max-width: ${NATIVE_FRAME_COMPACT_BREAKPOINT}) {
    grid-area: status;
  }
`;

const PackageCell = styled(Flex)`
  line-height: 1.4;

  @container native-frame-header (max-width: ${NATIVE_FRAME_COMPACT_BREAKPOINT}) {
    grid-area: package;
    flex-direction: row;
    align-items: baseline;
    gap: ${p => p.theme.space.xs};
  }
`;

const LeadHint = styled(Text)`
  display: block;
  max-width: 100%;
  line-height: 1.2;
  padding-right: 2px;

  @container native-frame-header (max-width: ${NATIVE_FRAME_COMPACT_BREAKPOINT}) {
    display: inline;
    flex: 0 0 auto;
    max-width: none;
  }
`;

const PackageLabel = styled(Text)`
  display: block;
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;

  @container native-frame-header (max-width: ${NATIVE_FRAME_COMPACT_BREAKPOINT}) {
    display: inline-block;
    flex: 1 1 auto;
  }
`;

const AddressCell = styled(Flex)`
  line-height: 1.4;

  @container native-frame-header (max-width: ${NATIVE_FRAME_COMPACT_BREAKPOINT}) {
    grid-area: address;
    justify-self: start;
    max-width: 72px;
    overflow: hidden;
  }
`;

const FunctionCell = styled(Flex)`
  word-break: break-all;

  @container native-frame-header (max-width: ${NATIVE_FRAME_COMPACT_BREAKPOINT}) {
    grid-area: function;
  }
`;

const FunctionName = styled(AnnotatedText)`
  min-width: 0;
  flex: 0 1 auto;
  word-break: break-all;
`;

const FileName = styled(Text)`
  border-bottom: 1px dashed ${p => p.theme.tokens.border.primary};
`;

const ActionsCell = styled(Flex)`
  min-width: 168px;

  @container native-frame-header (max-width: ${NATIVE_FRAME_COMPACT_BREAKPOINT}) {
    grid-area: actions;
    min-width: 0;
  }
`;
