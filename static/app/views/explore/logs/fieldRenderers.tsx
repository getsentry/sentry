import {DateTime} from 'sentry/components/dateTime';
import {Tooltip} from 'sentry/components/tooltip';
import {
  ColoredLogCircle,
  ColoredLogText,
  type getLogColors,
  LogDate,
  LogsHighlight,
  WrappingText,
} from 'sentry/views/explore/logs/styles';
import {
  getLogSeverityLevel,
  SeverityLevel,
  severityLevelToText,
} from 'sentry/views/explore/logs/utils';

export function severityCircleRenderer(
  severityNumber: number,
  severityText: string,
  logColors: ReturnType<typeof getLogColors>
) {
  const level = getLogSeverityLevel(severityNumber, severityText);
  const levelLabel = severityLevelToText(level);
  return (
    <Tooltip skipWrapper disabled={level === SeverityLevel.UNKNOWN} title={levelLabel}>
      <ColoredLogCircle logColors={logColors}>{severityText}</ColoredLogCircle>
    </Tooltip>
  );
}

export function severityTextRenderer(
  severityNumber: number,
  severityText: string,
  logColors: ReturnType<typeof getLogColors>,
  useFullSeverityText = false
) {
  const level = getLogSeverityLevel(severityNumber, severityText);
  const levelLabel = useFullSeverityText ? level : severityLevelToText(level);
  return <ColoredLogText logColors={logColors}>[{levelLabel}]</ColoredLogText>;
}

export function TimestampRenderer({timestamp}: {timestamp: string}) {
  return (
    <LogDate>
      <DateTime seconds date={timestamp} />
    </LogDate>
  );
}

export function bodyRenderer(body: string, highlightTerms: string[], wrap = false) {
  const highlightTerm = highlightTerms[0] ?? '';
  // TODO: Allow more than one highlight term to be highlighted at once.
  return (
    <WrappingText wrap={wrap}>
      <LogsHighlight text={highlightTerm}>{body}</LogsHighlight>
    </WrappingText>
  );
}
