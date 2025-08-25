import React, {Fragment, useCallback, useEffect, useRef, useState} from 'react';
import * as Sentry from '@sentry/react';

import {ExternalLink, Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import Count from 'sentry/components/count';
import {DateTime} from 'sentry/components/dateTime';
import useStacktraceLink from 'sentry/components/events/interfaces/frame/useStacktraceLink';
import Version from 'sentry/components/version';
import {tct} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {stripAnsi} from 'sentry/utils/ansiEscapeCodes';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {
  getFieldRenderer,
  type RenderFunctionBaggage,
} from 'sentry/utils/discover/fieldRenderers';
import {parseFunction, type ColumnValueType} from 'sentry/utils/discover/fields';
import {NumberContainer, VersionContainer} from 'sentry/utils/discover/styles';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useRelease} from 'sentry/utils/useRelease';
import {QuickContextHoverWrapper} from 'sentry/views/discover/table/quickContext/quickContextWrapper';
import {ContextType} from 'sentry/views/discover/table/quickContext/utils';
import {AnnotatedAttributeTooltip} from 'sentry/views/explore/components/annotatedAttributeTooltip';
import type {AttributesFieldRendererProps} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import {stripLogParamsFromLocation} from 'sentry/views/explore/contexts/logs/logsPageParams';
import type {
  TraceItemDetailsResponse,
  TraceItemResponseAttribute,
} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {LOG_ATTRIBUTE_LAZY_LOAD_HOVER_TIMEOUT} from 'sentry/views/explore/logs/constants';
import LogsTimestampTooltip from 'sentry/views/explore/logs/logsTimeTooltip';
import {
  AlignedCellContent,
  ColoredLogCircle,
  ColoredLogText,
  LogBasicRendererContainer,
  LogDate,
  LogsHighlight,
  WrappingText,
  type getLogColors,
} from 'sentry/views/explore/logs/styles';
import {
  OurLogKnownFieldKey,
  type LogAttributeItem,
  type LogRowItem,
  type OurLogFieldKey,
} from 'sentry/views/explore/logs/types';
import {
  adjustLogTraceID,
  getLogSeverityLevel,
  logOnceFactory,
  logsFieldAlignment,
  SeverityLevel,
  severityLevelToText,
} from 'sentry/views/explore/logs/utils';
import {TraceItemMetaInfo} from 'sentry/views/explore/utils';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

const {fmt} = Sentry.logger;

interface LogFieldRendererProps extends AttributesFieldRendererProps<RendererExtra> {}

export interface RendererExtra extends RenderFunctionBaggage {
  attributeTypes: Record<
    string,
    TraceItemResponseAttribute['type'] | EventsMetaType['fields'][string]
  >;
  attributes: Record<string, string | number | boolean>;
  highlightTerms: string[];
  logColors: ReturnType<typeof getLogColors>;
  align?: 'left' | 'center' | 'right';
  meta?: EventsMetaType;
  project?: Project;
  projectSlug?: string;
  shouldRenderHoverElements?: boolean;
  traceItemMeta?: TraceItemDetailsResponse['meta'];
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
  const preciseTimestamp = props.extra.attributes[OurLogKnownFieldKey.TIMESTAMP_PRECISE];

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
  const {wrapperProps, shouldLoad} = useLazyLoadAttributeOnHover(
    LOG_ATTRIBUTE_LAZY_LOAD_HOVER_TIMEOUT,
    props
  );
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
    enabled: shouldLoad,
  });
  const {data: codeLink} = useStacktraceLink(
    {
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
    },
    {
      enabled: shouldLoad && !!props.extra.projectSlug && !!release,
    }
  );

  return (
    <span data-test-id="hoverable-code-path" {...wrapperProps}>
      {codeLink?.sourceUrl ? (
        <Link data-test-id="hoverable-code-path-link" to={codeLink.sourceUrl}>
          {props.basicRendered}
        </Link>
      ) : (
        props.basicRendered
      )}
    </span>
  );
}

/**
 * This hook is used to lazy load an attribute on hover.
 * This is used to avoid rendering extra content (eg. making api calls) for constantly shown fields (eg. adding a column in the table view).
 */
function useLazyLoadAttributeOnHover(hoverTimeout: number, props: LogFieldRendererProps) {
  const [shouldLoad, setShouldLoad] = useState(props.extra.disableLazyLoad === true);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    if (shouldLoad) {
      return;
    }

    hoverTimeoutRef.current = setTimeout(() => {
      setShouldLoad(true);
    }, hoverTimeout);
  }, [hoverTimeout, shouldLoad]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  return {
    wrapperProps: {
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
    },
    shouldLoad,
  };
}

/**
 * This should only wrap the 'body' attribute as it is the only 'field' that is not returned by the trace-items endpoint (since it is not an attribute but rather a field).
 *
 * Once the trace-items endpoint returns 'body', we can remove this component.
 */
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
      <WrappingText wrapText={props.extra.wrapBody}>
        <LogsHighlight text={highlightTerm}>{stripAnsi(attribute_value)}</LogsHighlight>
      </WrappingText>
    </FilteredTooltip>
  );
}

function LogTemplateRenderer(props: LogFieldRendererProps) {
  return (
    <span>
      {typeof props.item.value === 'string'
        ? stripAnsi(props.item.value)
        : props.basicRendered}
    </span>
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
    return (
      <AnnotatedAttributeWrapper extra={props.extra} fieldKey={props.item.fieldKey}>
        {basicRendered}
      </AnnotatedAttributeWrapper>
    );
  }

  return (
    <AnnotatedAttributeWrapper extra={props.extra} fieldKey={props.item.fieldKey}>
      <AlignedCellContent align={align}>
        {customRenderer({...props, basicRendered})}
      </AlignedCellContent>
    </AnnotatedAttributeWrapper>
  );
}

const logInfoOnceHasRemarks = logOnceFactory('info');

function AnnotatedAttributeWrapper(props: {
  children: React.ReactNode;
  extra: RendererExtra;
  fieldKey: string;
}) {
  if (props.extra.traceItemMeta) {
    const metaInfo = new TraceItemMetaInfo(props.extra.traceItemMeta);
    if (metaInfo.hasRemarks(props.fieldKey)) {
      try {
        const remarks = metaInfo.getRemarks(props.fieldKey);
        const remark = remarks[0];
        if (remark) {
          const remarkType = remark.type;
          const remarkRuleId = remark.ruleId;
          logInfoOnceHasRemarks(
            fmt`AnnotatedAttributeWrapper: ${props.fieldKey} has remarks, rendering tooltip`,
            {
              organizationId: props.extra.organization.id,
              projectId: props.extra.projectSlug,
              remarkType,
              remarkRuleId,
            }
          );
        }
      } catch {
        // defensive
      }
      return (
        <AnnotatedAttributeTooltip extra={props.extra} fieldKey={props.fieldKey}>
          {props.children}
        </AnnotatedAttributeTooltip>
      );
    }
  }
  return props.children;
}

/**
 * Only formats the field the same as discover does, does not apply any additional rendering, but has a container to fix styling.
 */
function BasicDiscoverRenderer(props: LogFieldRendererProps) {
  const logMeta: EventsMetaType =
    Object.keys(props.meta ?? {}).length > 0 ? props.meta! : logFieldBasicMetas;
  const basicRenderer = getFieldRenderer(props.item.fieldKey, logMeta, false);
  const attributeType = props.extra.attributeTypes[props.item.fieldKey];
  const align = logsFieldAlignment(props.item.fieldKey, attributeType as ColumnValueType);
  let castValue: string | number | boolean | null = props.item.value;
  // TODO: Values being emitted by ProjectTraceItemDetails and Events should be the same type, and their type names should match (or be casted from rpc types to discover types).
  if (
    attributeType === 'int' ||
    attributeType === 'float' ||
    attributeType === 'size' ||
    attributeType === 'number' ||
    attributeType === 'integer' ||
    attributeType === 'duration' ||
    attributeType === 'percentage' ||
    attributeType === 'rate' ||
    attributeType === 'percent_change' ||
    attributeType === 'score'
  ) {
    castValue = Number(props.item.value);
  }
  if (attributeType === 'bool' || attributeType === 'boolean') {
    castValue = Boolean(props.item.value);
  }
  return (
    <LogBasicRendererContainer align={align}>
      {basicRenderer(
        {
          [props.item.fieldKey]: castValue,
        },
        {
          unit: logMeta.units[props.item.fieldKey] ?? undefined,
          ...props.extra,
          theme: props.extra.theme,
        }
      )}
    </LogBasicRendererContainer>
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
  [OurLogKnownFieldKey.PAYLOAD_SIZE]: BasicDiscoverRenderer,
};

const fullFieldToExistingField: Record<OurLogFieldKey, string> = {
  [OurLogKnownFieldKey.TRACE_ID]: 'trace',
};

// Meta returned from TraceItemDetails is empty, in which case we can provide our own meta to map known fields to their types to get the basic rendering working.
const logFieldBasicMetas: EventsMetaType = {
  fields: {
    [OurLogKnownFieldKey.PAYLOAD_SIZE]: 'size',
  },
  units: {
    [OurLogKnownFieldKey.PAYLOAD_SIZE]: 'byte', // SIZE_UNITS
  },
};
