import {usePrismTokensSourceContext} from 'sentry/components/events/interfaces/frame/usePrismTokensSourceContext';
import {
  hasAssembly,
  hasContextRegisters,
} from 'sentry/components/events/interfaces/frame/utils';
import {
  useStackTraceContext,
  useStackTraceFrameContext,
  useStackTraceViewState,
} from 'sentry/components/stackTrace/stackTraceContext';
import {Coverage} from 'sentry/types/integrations';
import type {LineCoverage} from 'sentry/types/integrations';
import {getFileExtension} from 'sentry/utils/fileExtension';

import {FrameContent} from './frameContent';

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

  const frameRegisters = frameIndex === frames.length - 1 ? stacktrace.registers : null;
  const expandedFrameRegisters =
    frameRegisters && hasContextRegisters(frameRegisters) ? frameRegisters : null;

  const hasSourceContext = contextLines.length > 0;
  const hasFrameVariables = !!frame.vars && Object.keys(frame.vars).length > 0;
  const hasFrameRegisters = !!expandedFrameRegisters;
  const hasFrameAssembly = hasAssembly(frame, platform);
  const hasAnyFrameDetails =
    hasSourceContext || hasFrameVariables || hasFrameRegisters || hasFrameAssembly;
  const shouldShowNoDetails =
    frameIndex === lastFrameIndex && frameIndex === 0 && !hasAnyFrameDetails;

  if (!isExpanded) {
    return null;
  }

  return (
    <FrameContent
      contextLines={contextLines}
      event={event}
      expandedFrameRegisters={expandedFrameRegisters}
      fileExtension={fileExtension}
      frame={frame}
      frameContextId={frameContextId}
      frameIndex={frameIndex}
      frameVariables={frame.vars}
      hasFrameAssembly={hasFrameAssembly}
      meta={meta}
      platform={platform}
      prismLines={prismLines}
      shouldShowNoDetails={shouldShowNoDetails}
      sourceLineCoverage={sourceLineCoverage}
    />
  );
}
