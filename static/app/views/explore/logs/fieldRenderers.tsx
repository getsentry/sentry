import {Fragment} from 'react';
import type {Location} from 'history';

import {DateTime} from 'sentry/components/dateTime';
import {Tooltip} from 'sentry/components/tooltip';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {
  CenteredRow,
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

interface LogFieldRendererProps {
  extra: RendererExtra;
  item: LogRowItem | LogAttributeItem;
  meta?: EventsMetaType;
  tableResultLogRow?: OurLogsResponseItem;
}

export interface RendererExtra {
  highlightTerms: string[];
  location: Location;
  logColors: ReturnType<typeof getLogColors>;
  organization: Organization;
  align?: 'left' | 'center' | 'right';
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

export function SeverityTextRenderer(props: LogFieldRendererProps) {
  const attribute_value = props.item.value as string;
  const _severityNumber = props.tableResultLogRow?.[OurLogKnownFieldKey.SEVERITY_NUMBER];
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

export function TimestampRenderer(props: LogFieldRendererProps) {
  return (
    <LogDate align={props.extra.align}>
      <DateTime seconds date={props.item.value} />
    </LogDate>
  );
}

export function TraceIDRenderer(props: LogFieldRendererProps) {
  return <div>{props.item.value}</div>;
}

export function LogBodyRenderer(props: LogFieldRendererProps) {
  const attribute_value = props.item.value as string;
  const highlightTerm = props.extra?.highlightTerms[0] ?? '';
  // TODO: Allow more than one highlight term to be highlighted at once.
  return (
    <WrappingText wrap={props.extra.wrapBody}>
      <LogsHighlight text={highlightTerm}>{attribute_value}</LogsHighlight>
    </WrappingText>
  );
}

function isLogRowItem(item: LogRowItem | LogAttributeItem): item is LogRowItem {
  return 'metaFieldType' in item;
}

export function LogFieldRenderer(props: LogFieldRendererProps) {
  const type = props.meta?.fields?.[props.item.fieldKey as OurLogFieldKey];

  const adjustedValue =
    props.item.fieldKey === OurLogKnownFieldKey.TRACE_ID
      ? adjustLogTraceID(props.item.value as string)
      : props.item.value;
  if (!isLogRowItem(props.item) || !defined(adjustedValue) || !type) {
    // Rendering inside attribute tree.
    return <Fragment>{adjustedValue}</Fragment>;
  }

  const renderer =
    getLogFieldRenderer(props.item.fieldKey) ??
    getFieldRenderer(props.item.fieldKey, props.meta ?? {}, false);

  const align = logsFieldAlignment(props.item.fieldKey, type);

  if (!renderer) {
    return <Fragment>{adjustedValue}</Fragment>;
  }

  return (
    <CenteredRow align={align}>
      {renderer({...props, [props.item.fieldKey]: adjustedValue}, props.extra)}
    </CenteredRow>
  );
}

export const LogAttributesRendererMap: Record<
  OurLogFieldKey,
  (props: LogFieldRendererProps) => React.ReactNode
> = {
  [OurLogKnownFieldKey.TIMESTAMP]: props => {
    return TimestampRenderer(props);
  },
  [OurLogKnownFieldKey.SEVERITY_TEXT]: SeverityTextRenderer,
  [OurLogKnownFieldKey.BODY]: LogBodyRenderer,
};

export function getLogFieldRenderer(field: OurLogFieldKey) {
  return LogAttributesRendererMap[field];
}
