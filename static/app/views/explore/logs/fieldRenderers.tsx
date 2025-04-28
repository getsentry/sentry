import {Fragment} from 'react';

import {Tooltip} from 'sentry/components/core/tooltip';
import {DateTime} from 'sentry/components/dateTime';
import Link from 'sentry/components/links/link';
import {defined} from 'sentry/utils';
import {stripAnsi} from 'sentry/utils/ansiEscapeCodes';
import {
  getFieldRenderer,
  type RenderFunctionBaggage,
} from 'sentry/utils/discover/fieldRenderers';
import type {AttributesFieldRendererProps} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import {stripLogParamsFromLocation} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {
  AlignedCellContent,
  ColoredLogCircle,
  ColoredLogText,
  type getLogColors,
  LogDate,
  LogsHighlight,
  WrappingText,
} from 'sentry/views/explore/logs/styles';
import {
  type LogAttributeItem,
  type LogRowItem,
  type OurLogFieldKey,
  OurLogKnownFieldKey,
  type OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';
import {
  adjustLogTraceID,
  getLogSeverityLevel,
  logsFieldAlignment,
  SeverityLevel,
  severityLevelToText,
} from 'sentry/views/explore/logs/utils';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

interface LogFieldRendererProps extends AttributesFieldRendererProps<RendererExtra> {}

interface RendererExtra extends RenderFunctionBaggage {
  highlightTerms: string[];
  logColors: ReturnType<typeof getLogColors>;
  tableResultLogRow: OurLogsResponseItem;
  align?: 'left' | 'center' | 'right';
  useFullSeverityText?: boolean;
  wrapBody?: true;
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

function SeverityTextRenderer(props: LogFieldRendererProps) {
  const attribute_value = props.item.value as string;
  const _severityNumber =
    props.extra.tableResultLogRow?.[OurLogKnownFieldKey.SEVERITY_NUMBER];
  const severityNumber = _severityNumber ? Number(_severityNumber) : null;
  const useFullSeverityText = props.extra.useFullSeverityText ?? false;
  const level = getLogSeverityLevel(severityNumber, attribute_value);
  const levelLabel = useFullSeverityText ? attribute_value : severityLevelToText(level);
  return (
    <AlignedCellContent align={props.extra.align}>
      <ColoredLogText logColors={props.extra.logColors}>{levelLabel}</ColoredLogText>
    </AlignedCellContent>
  );
}

// This is not in the field lookup and only exists for the prefix column in the logs table.
export function SeverityCircleRenderer(props: Omit<LogFieldRendererProps, 'item'>) {
  if (!props.extra.tableResultLogRow) {
    return null;
  }
  const attribute_value = props.extra.tableResultLogRow?.[OurLogKnownFieldKey.SEVERITY];
  const _severityNumber =
    props.extra.tableResultLogRow?.[OurLogKnownFieldKey.SEVERITY_NUMBER];

  const severityNumber = _severityNumber ? Number(_severityNumber) : null;
  const useFullSeverityText = props.extra.useFullSeverityText ?? false;
  const level = getLogSeverityLevel(severityNumber, attribute_value);
  const levelLabel = useFullSeverityText ? attribute_value : severityLevelToText(level);
  return (
    <AlignedCellContent align={props.extra.align}>
      <SeverityCircle
        level={level}
        levelLabel={levelLabel}
        severityText={attribute_value}
        logColors={props.extra.logColors}
      />
    </AlignedCellContent>
  );
}

function TimestampRenderer(props: LogFieldRendererProps) {
  return (
    <LogDate align={props.extra.align}>
      <DateTime seconds date={props.item.value} />
    </LogDate>
  );
}

export function TraceIDRenderer(props: LogFieldRendererProps) {
  const traceId = adjustLogTraceID(props.item.value as string);
  const location = stripLogParamsFromLocation(props.extra.location);
  const target = getTraceDetailsUrl({
    traceSlug: traceId,
    timestamp: props.extra.tableResultLogRow?.[OurLogKnownFieldKey.TIMESTAMP],
    organization: props.extra.organization,
    dateSelection: props.extra.location,
    location,
    source: TraceViewSources.LOGS,
  });
  return <Link to={target}>{props.basicRendered}</Link>;
}

export function LogBodyRenderer(props: LogFieldRendererProps) {
  const attribute_value = props.item.value as string;
  const highlightTerm = props.extra?.highlightTerms[0] ?? '';
  // TODO: Allow more than one highlight term to be highlighted at once.
  return (
    <WrappingText wrap={props.extra.wrapBody}>
      <LogsHighlight text={highlightTerm}>{stripAnsi(attribute_value)}</LogsHighlight>
    </WrappingText>
  );
}

function isLogRowItem(item: LogRowItem | LogAttributeItem): item is LogRowItem {
  return 'metaFieldType' in item;
}

export function LogFieldRenderer(props: LogFieldRendererProps) {
  const type = props.meta?.fields?.[props.item.fieldKey];
  const adjustedFieldKey =
    fullFieldToExistingField[props.item.fieldKey] ?? props.item.fieldKey;

  const adjustedValue =
    props.item.fieldKey === OurLogKnownFieldKey.TRACE_ID
      ? adjustLogTraceID(props.item.value as string)
      : props.item.value;
  if (!isLogRowItem(props.item) || !defined(adjustedValue) || !type) {
    // Rendering inside attribute tree.
    return <Fragment>{adjustedValue}</Fragment>;
  }

  const basicRenderer = getFieldRenderer(adjustedFieldKey, props.meta ?? {}, false);
  const basicRendered = basicRenderer(
    {...props, [adjustedFieldKey]: adjustedValue},
    {...props.extra, theme: props.extra.theme}
  );

  const customRenderer = LogAttributesRendererMap[props.item.fieldKey];

  const align = logsFieldAlignment(adjustedFieldKey, type);

  if (!customRenderer) {
    return <Fragment>{basicRendered}</Fragment>;
  }

  return (
    <AlignedCellContent align={align}>
      {customRenderer({...props, basicRendered})}
    </AlignedCellContent>
  );
}

export const LogAttributesRendererMap: Record<
  OurLogFieldKey,
  (props: LogFieldRendererProps) => React.ReactNode
> = {
  [OurLogKnownFieldKey.TIMESTAMP]: props => {
    return TimestampRenderer(props);
  },
  [OurLogKnownFieldKey.SEVERITY]: SeverityTextRenderer,
  [OurLogKnownFieldKey.MESSAGE]: LogBodyRenderer,
  [OurLogKnownFieldKey.TRACE_ID]: TraceIDRenderer,
};

const fullFieldToExistingField: Record<OurLogFieldKey, string> = {
  [OurLogKnownFieldKey.TRACE_ID]: 'trace',
};
