import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import type {Location} from 'history';

import {Tooltip} from 'sentry/components/core/tooltip';
import {DateTime} from 'sentry/components/dateTime';
import Link from 'sentry/components/links/link';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {stripAnsi} from 'sentry/utils/ansiEscapeCodes';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
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

interface LogFieldRendererProps {
  extra: RendererExtra;
  item: LogRowItem | LogAttributeItem;
  align?: 'left' | 'center' | 'right';
  basicRendered?: React.ReactNode;
  meta?: EventsMetaType;
  tableResultLogRow?: OurLogsResponseItem;
}

export interface RendererExtra {
  highlightTerms: string[];
  location: Location;
  logColors: ReturnType<typeof getLogColors>;
  organization: Organization;
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

export function SeverityTextRenderer(props: LogFieldRendererProps) {
  const attribute_value = props.item.value as string;
  const _severityNumber = props.tableResultLogRow?.[OurLogKnownFieldKey.SEVERITY_NUMBER];
  const severityNumber = _severityNumber ? Number(_severityNumber) : null;
  const useFullSeverityText = props.extra.useFullSeverityText ?? false;
  const level = getLogSeverityLevel(severityNumber, attribute_value);
  const levelLabel = useFullSeverityText ? attribute_value : severityLevelToText(level);
  return (
    <AlignedCellContent align={props.align}>
      <ColoredLogText logColors={props.extra.logColors}>{levelLabel}</ColoredLogText>
    </AlignedCellContent>
  );
}

// This is not in the field lookup and only exists for the prefix column in the logs table.
export function SeverityCircleRenderer(props: Omit<LogFieldRendererProps, 'item'>) {
  if (!props.tableResultLogRow) {
    return null;
  }
  const attribute_value = props.tableResultLogRow?.[OurLogKnownFieldKey.SEVERITY];
  const _severityNumber = props.tableResultLogRow?.[OurLogKnownFieldKey.SEVERITY_NUMBER];

  const severityNumber = _severityNumber ? Number(_severityNumber) : null;
  const useFullSeverityText = props.extra.useFullSeverityText ?? false;
  const level = getLogSeverityLevel(severityNumber, attribute_value);
  const levelLabel = useFullSeverityText ? attribute_value : severityLevelToText(level);
  return (
    <AlignedCellContent align={props.align}>
      <SeverityCircle
        level={level}
        levelLabel={levelLabel}
        severityText={attribute_value}
        logColors={props.extra.logColors}
      />
    </AlignedCellContent>
  );
}

export function TimestampRenderer(props: LogFieldRendererProps) {
  return (
    <LogDate align={props.extra.align}>
      <DateTime seconds date={props.item.value} />
    </LogDate>
  );
}

export function TraceIDRenderer(props: LogFieldRendererProps) {
  const traceId = props.item.value as string;
  const location = stripLogParamsFromLocation(props.extra.location);
  const target = getTraceDetailsUrl({
    traceSlug: traceId,
    timestamp: props.tableResultLogRow?.[OurLogKnownFieldKey.TIMESTAMP],
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
  const theme = useTheme();
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
    {...props.extra, theme}
  );

  const customRenderer = getLogFieldRenderer(props.item.fieldKey);

  const align = logsFieldAlignment(adjustedFieldKey, type);

  if (!customRenderer) {
    return <Fragment>{basicRendered}</Fragment>;
  }

  return (
    <AlignedCellContent align={align}>
      {customRenderer({...props, align, basicRendered})}
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

export function getLogFieldRenderer(field: OurLogFieldKey) {
  return LogAttributesRendererMap[field];
}

const fullFieldToExistingField: Record<OurLogFieldKey, string> = {
  [OurLogKnownFieldKey.TRACE_ID]: 'trace',
};
