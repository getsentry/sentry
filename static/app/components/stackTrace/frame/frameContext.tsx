import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Container, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Assembly} from 'sentry/components/events/interfaces/frame/assembly';
import {FrameRegisters} from 'sentry/components/events/interfaces/frame/frameRegisters';
import {usePrismTokensSourceContext} from 'sentry/components/events/interfaces/frame/usePrismTokensSourceContext';
import {
  hasAssembly,
  hasContextRegisters,
} from 'sentry/components/events/interfaces/frame/utils';
import {parseAssembly} from 'sentry/components/events/interfaces/utils';
import {FrameVariablesGrid} from 'sentry/components/stackTrace/frame/frameVariablesGrid';
import {
  useStackTraceContext,
  useStackTraceFrameContext,
  useStackTraceViewState,
} from 'sentry/components/stackTrace/stackTraceContext';
import {t} from 'sentry/locale';
import {Coverage, type LineCoverage} from 'sentry/types/integrations';
import {getFileExtension} from 'sentry/utils/fileExtension';

const SOURCE_LINE_NUMBER_DIGITS = 4;
const COVERAGE_TEXT: Record<Coverage, string | undefined> = {
  [Coverage.NOT_COVERED]: t('Line uncovered by tests'),
  [Coverage.COVERED]: t('Line covered by tests'),
  [Coverage.PARTIAL]: t('Line partially covered by tests'),
  [Coverage.NOT_APPLICABLE]: undefined,
};

function getLineCoverage(
  lines: Array<[number, string | null]>,
  lineCoverage: LineCoverage[]
): Array<Coverage | undefined> {
  const coverageByLine = new Map<number, Coverage>(lineCoverage);
  return lines.map(([lineNo]) => coverageByLine.get(lineNo));
}

export function FrameContext() {
  const {event, frame, frameContextId, frameIndex, isExpanded, platform} =
    useStackTraceFrameContext();
  const {frames, getFrameLineCoverage, lastFrameIndex, meta, stacktrace} =
    useStackTraceContext();
  const {isMinified} = useStackTraceViewState();
  const contextLines = isExpanded ? (frame.context ?? []) : [];
  const fileExtension = isExpanded ? (getFileExtension(frame.filename ?? '') ?? '') : '';
  const prismLines = usePrismTokensSourceContext({
    contextLines,
    lineNo: frame.lineNo,
    fileExtension,
  });
  const lineCoverage = getFrameLineCoverage?.({
    event,
    frame,
    frameIndex,
    isMinified,
    stacktrace,
  });
  const sourceLineCoverage = lineCoverage
    ? getLineCoverage(contextLines, lineCoverage)
    : [];
  const frameVariables = frame.vars;
  const hasFrameVariables = !!frameVariables && Object.keys(frameVariables).length > 0;
  const frameRegisters = frameIndex === frames.length - 1 ? stacktrace.registers : null;
  const expandedFrameRegisters =
    frameRegisters && hasContextRegisters(frameRegisters) ? frameRegisters : null;
  const hasFrameRegisters = !!expandedFrameRegisters;
  const hasFrameAssembly = hasAssembly(frame, platform);
  const showEmptySourceNotation = frameIndex === lastFrameIndex && frameIndex === 0;
  const hasSourceContext = contextLines.length > 0;
  const hasAnyFrameDetails =
    hasSourceContext || hasFrameVariables || hasFrameRegisters || hasFrameAssembly;
  const shouldShowNoDetails = showEmptySourceNotation && !hasAnyFrameDetails;

  if (!isExpanded) {
    return null;
  }

  return (
    <Container
      id={frameContextId}
      borderTop="primary"
      background="primary"
      overflowX="hidden"
      data-test-id="core-stacktrace-frame-context"
    >
      {hasSourceContext ? (
        <FrameSourceGrid>
          {contextLines.map(([lineNumber, lineValue], lineIndex) => (
            <FrameSourceRow
              key={`${lineNumber}-${lineIndex}`}
              data-test-id="core-stacktrace-frame-source-row"
              isActive={lineNumber === frame.lineNo}
            >
              <Tooltip
                skipWrapper
                title={
                  COVERAGE_TEXT[sourceLineCoverage[lineIndex] ?? Coverage.NOT_APPLICABLE]
                }
              >
                <FrameSourceLineNumber
                  as="div"
                  size="sm"
                  variant="muted"
                  monospace
                  aria-label={`Line ${lineNumber}`}
                  isActive={lineNumber === frame.lineNo}
                  coverage={sourceLineCoverage[lineIndex] ?? Coverage.NOT_APPLICABLE}
                >
                  {lineNumber}
                </FrameSourceLineNumber>
              </Tooltip>
              <FrameSourceCode
                className={fileExtension ? `language-${fileExtension}` : undefined}
              >
                {(
                  prismLines[lineIndex] ?? [
                    {children: lineValue ?? '', className: 'token'},
                  ]
                ).map((token, tokenIndex) => (
                  <span key={tokenIndex} className={token.className}>
                    {token.children}
                  </span>
                ))}
              </FrameSourceCode>
            </FrameSourceRow>
          ))}
        </FrameSourceGrid>
      ) : shouldShowNoDetails ? (
        <Container padding="sm md">
          <Text size="xs" variant="muted">
            {t('No additional details are available for this frame.')}
          </Text>
        </Container>
      ) : null}
      {hasFrameVariables ? (
        <Container
          borderTop="primary"
          padding="sm md"
          data-test-id="core-stacktrace-frame-vars"
        >
          <FrameVariablesGrid
            platform={platform}
            data={frameVariables}
            meta={meta?.frames?.[frameIndex]?.vars}
          />
        </Container>
      ) : null}
      {hasFrameRegisters ? (
        <Container borderTop="primary">
          <FrameRegisters
            registers={expandedFrameRegisters}
            meta={meta?.registers}
            deviceArch={event.contexts?.device?.arch}
          />
        </Container>
      ) : null}
      {hasFrameAssembly ? (
        <Container borderTop="primary">
          <Assembly {...parseAssembly(frame.package ?? null)} />
        </Container>
      ) : null}
    </Container>
  );
}

const FrameSourceGrid = styled(Grid)`
  width: 100%;
  min-width: 0;
`;

const FrameSourceRow = styled(Grid)<{isActive: boolean}>`
  grid-template-columns:
    calc(${SOURCE_LINE_NUMBER_DIGITS}ch + ${p => p.theme.space.sm})
    1fr;
  align-items: start;
  min-width: 0;
  background: ${p => (p.isActive ? p.theme.tokens.background.secondary : 'transparent')};
`;

const FrameSourceLineNumber = styled(Text)<{
  coverage: Coverage;
  isActive: boolean;
}>`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-height: 1.8em;
  line-height: 1.8;
  text-align: right;
  user-select: none;
  text-box-trim: none;
  text-box-edge: auto;
  padding-left: ${p => p.theme.space.xs};
  padding-right: ${p => p.theme.space.xs};
  border-right: 3px solid transparent;

  ${p =>
    p.coverage === Coverage.COVERED &&
    css`
      background: ${p.theme.colors.green100};
      border-right-color: ${p.theme.tokens.border.success.vibrant};
    `}

  ${p =>
    p.coverage === Coverage.NOT_COVERED &&
    css`
      background: ${p.theme.colors.red100};
      border-right-color: ${p.theme.tokens.border.danger.vibrant};
    `}

  ${p =>
    p.coverage === Coverage.PARTIAL &&
    css`
      background: ${p.theme.colors.yellow100};
      border-right-style: dashed;
      border-right-color: ${p.theme.tokens.border.warning.vibrant};
    `}

  ${p =>
    p.isActive &&
    p.coverage === Coverage.PARTIAL &&
    css`
      background: ${p.theme.colors.yellow200};
    `}

  ${p =>
    p.isActive &&
    p.coverage === Coverage.COVERED &&
    css`
      background: ${p.theme.colors.green200};
    `}

  ${p =>
    p.isActive &&
    p.coverage === Coverage.NOT_COVERED &&
    css`
      background: ${p.theme.colors.red200};
    `}
`;

const FrameSourceCode = styled('code')`
  color: ${p => p.theme.tokens.content.primary};
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.sm};
  line-height: 1.8;
  display: block;
  min-width: 0;
  background: transparent;
  padding: 0;
  border-radius: 0;

  && {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
    background: transparent;
  }
`;
