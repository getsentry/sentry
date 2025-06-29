import React, {Fragment} from 'react';

import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import Count from 'sentry/components/count';
import {DateTime} from 'sentry/components/dateTime';
import useStacktraceLink from 'sentry/components/events/interfaces/frame/useStacktraceLink';
import ExternalLink from 'sentry/components/links/externalLink';
import Version from 'sentry/components/version';
import {tct} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {stripAnsi} from 'sentry/utils/ansiEscapeCodes';
import {
  getFieldRenderer,
  type RenderFunctionBaggage,
} from 'sentry/utils/discover/fieldRenderers';
import {parseFunction} from 'sentry/utils/discover/fields';
import {NumberContainer, VersionContainer} from 'sentry/utils/discover/styles';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useRelease} from 'sentry/utils/useRelease';
import {QuickContextHoverWrapper} from 'sentry/views/discover/table/quickContext/quickContextWrapper';
import {ContextType} from 'sentry/views/discover/table/quickContext/utils';
import type {AttributesFieldRendererProps} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import {stripLogParamsFromLocation} from 'sentry/views/explore/contexts/logs/logsPageParams';
import LogsTimestampTooltip from 'sentry/views/explore/logs/logsTimeTooltip';
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

export interface RendererExtra extends RenderFunctionBaggage {
  attributes: Record<string, string | number | boolean>;
  highlightTerms: string[];
  logColors: ReturnType<typeof getLogColors>;
  align?: 'left' | 'center' | 'right';
  projectSlug?: string;
  shouldRenderHoverElements?: boolean;
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
  const _severityNumber = props.extra.attributes?.[OurLogKnownFieldKey.SEVERITY_NUMBER];
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
  if (!props.extra.attributes) {
    return null;
  }
  const _severityText = props.extra.attributes?.[OurLogKnownFieldKey.SEVERITY];
  const _severityNumber = props.extra.attributes?.[OurLogKnownFieldKey.SEVERITY_NUMBER];

  const severityNumber = _severityNumber ? Number(_severityNumber) : null;
  const severityText = _severityText ? String(_severityText) : 'unknown';
  const useFullSeverityText = props.extra.useFullSeverityText ?? false;
  const level = getLogSeverityLevel(severityNumber, severityText);
  const levelLabel = useFullSeverityText ? severityText : severityLevelToText(level);
  return (
    <AlignedCellContent align={props.extra.align}>
      <SeverityCircle
        level={level}
        levelLabel={levelLabel}
        severityText={severityText}
        logColors={props.extra.logColors}
      />
    </AlignedCellContent>
  );
}

function TimestampRenderer(props: LogFieldRendererProps) {
  const preciseTimestamp =
    props.extra.attributes?.['tags[sentry.timestamp_precise,number]'];
  const timestampToUse = preciseTimestamp
    ? new Date(Number(preciseTimestamp) / 1_000_000) // Convert nanoseconds to milliseconds
    : props.item.value;

  return (
    <LogDate align={props.extra.align}>
      <LogsTimestampTooltip
        timestamp={props.item.value as string | number}
        attributes={props.extra.attributes}
        shouldRender={props.extra.shouldRenderHoverElements}
      >
        <DateTime seconds milliseconds date={timestampToUse} />
      </LogsTimestampTooltip>
    </LogDate>
  );
}

function CodePathRenderer(props: LogFieldRendererProps) {
  const codeLineNumber = props.extra.attributes?.[OurLogKnownFieldKey.CODE_LINE_NUMBER];
  const codeFunctionName =
    props.extra.attributes?.[OurLogKnownFieldKey.CODE_FUNCTION_NAME];
  const releaseVersion = props.extra.attributes?.[OurLogKnownFieldKey.RELEASE];
  const sdkName = props.extra.attributes?.[OurLogKnownFieldKey.SDK_NAME];
  const sdkVersion = props.extra.attributes?.[OurLogKnownFieldKey.SDK_VERSION];
  const sdk =
    typeof sdkVersion === 'string' && typeof sdkName === 'string'
      ? {
          name: sdkName,
          version: sdkVersion,
        }
      : undefined;
  const filename = props.item.value;

  const {data: release} = useRelease({
    orgSlug: props.extra.organization.slug,
    projectSlug: props.extra.projectSlug ?? '',
    releaseVersion: typeof releaseVersion === 'string' ? releaseVersion : '',
  });
  const {data: codeLink} = useStacktraceLink({
    event: {
      release,
      sdk,
    },
    frame: {
      function: typeof codeFunctionName === 'string' ? codeFunctionName : undefined,
      lineNo: codeLineNumber ? +codeLineNumber : undefined,
      filename: typeof filename === 'string' ? filename : undefined,
    },
    orgSlug: props.extra.organization.slug,
    projectSlug: props.extra.projectSlug ?? '',
  });

  if (codeLink?.sourceUrl) {
    return <Link to={codeLink.sourceUrl}>{props.basicRendered}</Link>;
  }

  return props.basicRendered;
}

function FilteredTooltip({
  value,
  children,
  extra,
}: {
  children: React.ReactNode;
  extra: RendererExtra;
  value: string | number | null;
}) {
  if (
    !value ||
    typeof value !== 'string' ||
    !value.includes('[Filtered]') ||
    !extra.projectSlug
  ) {
    return <React.Fragment>{children}</React.Fragment>;
  }
  return (
    <Tooltip
      title={tct(
        "This field contains content scrubbed by our [filters] to protect your users' privacy. If necessary, you can turn this off in your [settings].",
        {
          filters: (
            <ExternalLink href="https://docs.sentry.io/product/data-management-settings/scrubbing/server-side-scrubbing/">
              {'Data Scrubber'}
            </ExternalLink>
          ),
          settings: (
            <Link
              to={normalizeUrl(
                `/settings/${extra.organization.slug}/projects/${extra.projectSlug}/security-and-privacy/`
              )}
            >
              {'Settings, under Security & Privacy'}
            </Link>
          ),
        }
      )}
      isHoverable
    >
      {children}
    </Tooltip>
  );
}

function TraceIDRenderer(props: LogFieldRendererProps) {
  const traceId = adjustLogTraceID(props.item.value as string);
  const location = stripLogParamsFromLocation(props.extra.location);
  const timestamp = props.extra.attributes?.[OurLogKnownFieldKey.TIMESTAMP];
  const target = getTraceDetailsUrl({
    traceSlug: traceId,
    timestamp:
      typeof timestamp === 'string' || typeof timestamp === 'number'
        ? timestamp
        : undefined,
    organization: props.extra.organization,
    dateSelection: props.extra.location,
    location,
    source: TraceViewSources.LOGS,
  });
  return <Link to={target}>{props.basicRendered}</Link>;
}

function ReleaseRenderer(props: LogFieldRendererProps) {
  const release = props.item.value as string;
  if (!release) {
    return props.basicRendered;
  }
  return (
    <VersionContainer>
      <QuickContextHoverWrapper
        dataRow={{...props.extra.attributes, release}}
        contextType={ContextType.RELEASE}
        organization={props.extra.organization}
      >
        <Version version={release} truncate />
      </QuickContextHoverWrapper>
    </VersionContainer>
  );
}

export function LogBodyRenderer(props: LogFieldRendererProps) {
  const attribute_value = props.item.value as string;
  const highlightTerm = props.extra?.highlightTerms[0] ?? '';
  // TODO: Allow more than one highlight term to be highlighted at once.
  return (
    <FilteredTooltip value={props.item.value} extra={props.extra}>
      <WrappingText wrap={props.extra.wrapBody}>
        <LogsHighlight text={highlightTerm}>{stripAnsi(attribute_value)}</LogsHighlight>
      </WrappingText>
    </FilteredTooltip>
  );
}

function LogTemplateRenderer(props: LogFieldRendererProps) {
  return (
    <FilteredTooltip value={props.item.value} extra={props.extra}>
      <span>
        {typeof props.item.value === 'string'
          ? stripAnsi(props.item.value)
          : props.basicRendered}
      </span>
    </FilteredTooltip>
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

  if (parseFunction(adjustedFieldKey)) {
    // in the aggregates table, render sum(blah)
    return (
      <NumberContainer>
        {typeof adjustedValue === 'number' ? (
          <Count value={adjustedValue} />
        ) : (
          adjustedValue
        )}
      </NumberContainer>
    );
  }

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
  [OurLogKnownFieldKey.CODE_FILE_PATH]: CodePathRenderer,
  [OurLogKnownFieldKey.RELEASE]: ReleaseRenderer,
  [OurLogKnownFieldKey.TEMPLATE]: LogTemplateRenderer,
};

const fullFieldToExistingField: Record<OurLogFieldKey, string> = {
  [OurLogKnownFieldKey.TRACE_ID]: 'trace',
};
