import isNumber from 'lodash/isNumber';
import moment from 'moment-timezone';

import {Tooltip} from 'sentry/components/tooltip';
import getDynamicText from 'sentry/utils/getDynamicText';
import {useUser} from 'sentry/utils/useUser';
import {
  ColoredLogCircle,
  ColoredLogText,
  LogDate,
  LogsHighlight,
  WrappingText,
} from 'sentry/views/explore/logs/styles';
import {
  getLogSeverityLevel,
  SeverityLevel,
  severityLevelToColorLevel,
  severityLevelToText,
} from 'sentry/views/explore/logs/utils';

export function severityCircleRenderer(severityNumber: number, severityText: string) {
  const level = getLogSeverityLevel(severityNumber, severityText);
  const levelLabel = severityLevelToText(level);
  const levelColor = severityLevelToColorLevel(level);
  return (
    <Tooltip skipWrapper disabled={level === SeverityLevel.UNKNOWN} title={levelLabel}>
      <ColoredLogCircle level={levelColor}>{severityText}</ColoredLogCircle>
    </Tooltip>
  );
}

export function severityTextRenderer(
  severityNumber: number,
  severityText: string,
  useFullSeverityText: boolean = false
) {
  const level = getLogSeverityLevel(severityNumber, severityText);
  const levelLabel = useFullSeverityText ? level : severityLevelToText(level);
  const levelColor = severityLevelToColorLevel(level);
  return <ColoredLogText level={levelColor}>[{levelLabel}]</ColoredLogText>;
}

type RelaxedDateType = string | number | Date;
function getDateObj(date: RelaxedDateType): Date {
  return typeof date === 'string' || isNumber(date) ? new Date(date) : date;
}

export function TimestampRenderer({timestamp}: {timestamp: string}) {
  const user = useUser();
  const options = user ? user.options : null;

  const baseFormat = 'MMM D, YYYY h:mm:ss A z';
  const format = options?.clock24Hours ? 'MMMM D, YYYY HH:mm z' : baseFormat;

  const dateObj = getDateObj(timestamp);

  const date = getDynamicText({
    fixed: options?.clock24Hours
      ? 'November 3, 2020 08:57 UTC'
      : 'November 3, 2020 8:58 AM UTC',
    value: moment.tz(dateObj, options?.timezone ?? '').format(format),
  });
  return <LogDate>{date}</LogDate>;
}

export function bodyRenderer(
  body: string,
  highlightTerms: string[],
  wrap: boolean = false
) {
  const highlightTerm = highlightTerms[0] ?? '';
  // TODO: Allow more than one highlight term to be highlighted at once.
  return (
    <WrappingText wrap={wrap}>
      <LogsHighlight text={highlightTerm}>{body}</LogsHighlight>
    </WrappingText>
  );
}
