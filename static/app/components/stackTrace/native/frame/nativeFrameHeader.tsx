import {useState} from 'react';
import styled from '@emotion/styled';

import {InfoText} from '@sentry/scraps/info';
import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {getLeadHint, trimPackage} from 'sentry/components/events/interfaces/frame/utils';
import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {useNativeDisplayOptionsContext} from 'sentry/components/stackTrace/displayOptionsContext';
import {useNativeStackTraceContext} from 'sentry/components/stackTrace/native/nativeStackTraceContext';
import {
  useStackTraceContext,
  useStackTraceFrameContext,
  useStackTraceViewState,
} from 'sentry/components/stackTrace/stackTraceContext';
import type {
  StackTraceFrameHeaderProps,
  StackTraceFrameMeta,
} from 'sentry/components/stackTrace/types';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';

import {isDartAsyncSuspension} from './actions/getSymbolicatorStatus';
import {SymbolicatorStatusIcon} from './actions/symbolicatorStatusIcon';
import {NativeFrameAddress} from './nativeFrameAddress';

function getFunctionLabel({
  frame,
  frameMeta,
  verboseFunctionNames,
}: {
  frame: ReturnType<typeof useStackTraceFrameContext>['frame'];
  frameMeta: StackTraceFrameMeta | undefined;
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

export function NativeFrameHeader({actions}: StackTraceFrameHeaderProps) {
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

  const resolvedActions = typeof actions === 'function' ? actions({isHovering}) : actions;

  return (
    <Container containerType="inline-size">
      <HeaderGrid
        align="center"
        columns={{
          zero: hasAnyStatusIcons
            ? '16px minmax(0, 120px) minmax(0, 1fr)'
            : 'minmax(0, 120px) minmax(0, 1fr)',
          lg: hasAnyStatusIcons
            ? '16px 150px 120px minmax(0, 1fr) minmax(168px, auto)'
            : '150px 120px minmax(0, 1fr) minmax(168px, auto)',
        }}
        gap={{zero: '2xs sm', lg: '0 md'}}
        padding="xs md"
        data-test-id="native-stack-trace-frame-title"
        data-sub-frame={isSubFrame ? true : undefined}
        isExpandable={isExpandable}
        isInAppFrame={frame.inApp}
        isSubFrame={isSubFrame}
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
          <Flex
            align="center"
            justify="center"
            column="1"
            row={{zero: '1 / 3', lg: '1'}}
            data-test-id="native-stack-trace-status-cell"
          >
            <SymbolicatorStatusIcon />
          </Flex>
        ) : null}

        <Flex
          direction={{zero: 'row', lg: 'column'}}
          align={{zero: 'baseline', lg: 'start'}}
          column={{
            zero: hasAnyStatusIcons ? '3' : '2',
            lg: hasAnyStatusIcons ? '2' : '1',
          }}
          row="1"
          gap={{zero: 'xs', lg: '0'}}
          justify="center"
          minWidth={0}
          overflow="hidden"
        >
          {showLeadHint ? (
            <Container flexShrink={0}>
              <Text size="xs" variant="muted" ellipsis>
                {getLeadHint({event, hasNextFrame: defined(nextFrame)})}
              </Text>
            </Container>
          ) : null}
          <InfoText
            title={
              frame.package ??
              (isDartAsync ? t('Dart async operation') : t('Go to images loaded'))
            }
            maxWidth={400}
            delay={1000}
            position="auto-start"
            variant="inherit"
            ellipsis
          >
            <Container as="span" paddingRight="2xs">
              {packageLabel ??
                (isDartAsync ? (
                  t('Dart async')
                ) : (
                  <Text as="span" variant="muted">
                    {t('<unknown>')}
                  </Text>
                ))}
            </Container>
          </InfoText>
        </Flex>

        <Flex
          align="center"
          minWidth={0}
          overflow="hidden"
          column={{
            zero: hasAnyStatusIcons ? '2' : '1',
            lg: hasAnyStatusIcons ? '3' : '2',
          }}
          row="1"
        >
          <NativeFrameAddress />
        </Flex>

        <Flex
          wrap="wrap"
          align="baseline"
          gap="2xs xs"
          minWidth={0}
          column={{
            zero: hasAnyStatusIcons ? '2 / -1' : '1 / -1',
            lg: hasAnyStatusIcons ? '4' : '3',
          }}
          row={{zero: '2', lg: '1'}}
        >
          {functionLabel ? (
            <Tooltip
              title={frame.rawFunction ?? frame.symbol}
              disabled={!(frame.rawFunction ?? frame.symbol)}
            >
              <FunctionName value={functionLabel.value} meta={functionLabel.meta} />
            </Tooltip>
          ) : isDartAsync ? (
            t('Dart')
          ) : (
            <Text variant="muted">{`<${t('unknown')}>`}</Text>
          )}
          {frame.filename ? (
            <InfoText
              title={frame.absPath || frame.filename}
              maxWidth={400}
              position="auto-start"
              size="sm"
              variant="muted"
              wordBreak="break-all"
            >
              {'('}
              {absoluteFilePaths ? (frame.absPath ?? frame.filename) : frame.filename}
              {frame.lineNo ? `:${frame.lineNo}` : ''}
              {')'}
            </InfoText>
          ) : null}
        </Flex>

        <Flex
          align="center"
          justify="end"
          gap="xs"
          minWidth={0}
          column={{
            zero: hasAnyStatusIcons ? '2 / -1' : '1 / -1',
            lg: hasAnyStatusIcons ? '5' : '4',
          }}
          row={{zero: '3', lg: '1'}}
          data-test-id="native-stack-trace-frame-actions"
        >
          {resolvedActions}
        </Flex>
      </HeaderGrid>
    </Container>
  );
}

const HeaderGrid = styled(Grid)<{
  isExpandable: boolean;
  isInAppFrame: boolean;
  isSubFrame: boolean;
}>`
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
`;

const FunctionName = styled(AnnotatedText)`
  min-width: 0;
  flex: 0 1 auto;
  word-break: break-all;
`;
