import {Fragment} from 'react';

import {DateTime} from 'sentry/components/dateTime';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {
  ColoredLogCircle,
  ColoredLogText,
  type getLogColors,
  LogDate,
  LogsHighlight,
  WrappingText,
} from 'sentry/views/explore/logs/styles';
import {
  type OurLogFieldKey,
  OurLogKnownFieldKey,
  type OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';
import type {OurLogsTableRowDetails} from 'sentry/views/explore/logs/useLogsQuery';
import {
  getLogSeverityLevel,
  SeverityLevel,
  severityLevelToText,
} from 'sentry/views/explore/logs/utils';

interface FieldRendererProps {
  attribute_value: any;
  extra: RendererExtra;
  detailedLogRow?: OurLogsTableRowDetails;
  tableResultLogRow?: OurLogsResponseItem;
}

export interface RendererExtra {
  highlightTerms: string[];
  logColors: ReturnType<typeof getLogColors>;
  renderSeverityCircle?: boolean;
  useFullSeverityText?: boolean;
  wrapBody?: boolean;
}

function SeverityCircle(props: {
  level: SeverityLevel;
  levelLabel: string;
  logColors: ReturnType<typeof getLogColors>;
  severityText: string;
}) {
  return (
    <Tooltip
      skipWrapper
      disabled={props.level === SeverityLevel.UNKNOWN}
      title={props.levelLabel}
    >
      <ColoredLogCircle logColors={props.logColors}>
        {props.severityText}
      </ColoredLogCircle>
    </Tooltip>
  );
}

export function severityTextRenderer(props: FieldRendererProps) {
  const attribute_value = props.attribute_value as string;
  const _severityNumber = props.tableResultLogRow?.severity_number;
  const severityNumber = _severityNumber ? Number(_severityNumber) : null;
  const useFullSeverityText = props.extra.useFullSeverityText ?? false;
  const level = getLogSeverityLevel(severityNumber, attribute_value);
  const levelLabel = useFullSeverityText ? attribute_value : severityLevelToText(level);
  const renderSeverityCircle = props.extra.renderSeverityCircle ?? false;
  return (
    <Fragment>
      {renderSeverityCircle && (
        <SeverityCircle
          level={level}
          levelLabel={levelLabel}
          severityText={attribute_value}
          logColors={props.extra.logColors}
        />
      )}

      <ColoredLogText logColors={props.extra.logColors}>[{levelLabel}]</ColoredLogText>
    </Fragment>
  );
}

export function TimestampRenderer(props: FieldRendererProps) {
  return (
    <LogDate>
      <DateTime seconds date={props.attribute_value} />
    </LogDate>
  );
}

export function bodyRenderer(props: FieldRendererProps) {
  const attribute_value = props.attribute_value as string;
  const highlightTerm = props.extra.highlightTerms[0] ?? '';
  // TODO: Allow more than one highlight term to be highlighted at once.
  return (
    <WrappingText wrap={props.extra.wrapBody}>
      <LogsHighlight text={highlightTerm}>{attribute_value}</LogsHighlight>
    </WrappingText>
  );
}

export const LogAttributesRendererMap: Record<
  OurLogFieldKey,
  (props: {attribute_value: any; extra?: RendererExtra}) => React.ReactNode
> = {
  [OurLogKnownFieldKey.TIMESTAMP]: props => {
    // Ensure extra is defined for the wrapped function
    const extra = props.extra || {
      highlightTerms: [],
      logColors: {} as ReturnType<typeof getLogColors>,
    };
    return TimestampRenderer({...props, extra});
  },
  [OurLogKnownFieldKey.SEVERITY_TEXT]: props => {
    // Ensure extra is defined for the wrapped function
    const extra = props.extra || {
      highlightTerms: [],
      logColors: {} as ReturnType<typeof getLogColors>,
    };
    return severityTextRenderer({...props, extra});
  },
};

export const LogAttributesHumanLabel: Record<OurLogFieldKey, string> = {
  [OurLogKnownFieldKey.TIMESTAMP]: t('Timestamp'),
  [OurLogKnownFieldKey.SEVERITY_TEXT]: t('Severity'),
};

export const HiddenLogAttributes: OurLogFieldKey[] = [
  OurLogKnownFieldKey.SEVERITY_NUMBER,
  OurLogKnownFieldKey.ID,
  OurLogKnownFieldKey.BODY,
];
