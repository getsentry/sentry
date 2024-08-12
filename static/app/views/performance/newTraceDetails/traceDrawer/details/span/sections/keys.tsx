import {Fragment, useMemo} from 'react';

import {Button} from 'sentry/components/button';
import {
  rawSpanKeys,
  type RawSpanType,
} from 'sentry/components/events/interfaces/spans/types';
import {
  getSpanSubTimings,
  isHiddenDataKey,
  type SubTimingInfo,
} from 'sentry/components/events/interfaces/spans/utils';
import {OpsDot} from 'sentry/components/events/opsBreakdown';
import FileSize from 'sentry/components/fileSize';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import {IconAdd} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {
  KeyValueListDataItem,
  MetricsExtractionRule,
  Organization,
} from 'sentry/types';
import {defined} from 'sentry/utils';
import {getUtcDateString} from 'sentry/utils/dates';
import {getMetricsUrl} from 'sentry/utils/metrics';
import {hasCustomMetricsExtractionRules} from 'sentry/utils/metrics/features';
import {MetricDisplayType} from 'sentry/utils/metrics/types';
import {createVirtualMRI} from 'sentry/utils/metrics/virtualMetricsContext';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';
import useOrganization from 'sentry/utils/useOrganization';
import {isSpanNode} from 'sentry/views/performance/newTraceDetails/guards';
import {
  type SectionCardKeyValueList,
  TraceDrawerComponents,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import {
  type TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {getPerformanceDuration} from 'sentry/views/performance/utils/getPerformanceDuration';
import {openExtractionRuleCreateModal} from 'sentry/views/settings/projectMetrics/metricsExtractionRuleCreateModal';
import {useMetricsExtractionRules} from 'sentry/views/settings/projectMetrics/utils/useMetricsExtractionRules';

const SIZE_DATA_KEYS = [
  'Encoded Body Size',
  'Decoded Body Size',
  'Transfer Size',
  'http.request_content_length',
  'http.response_content_length',
  'http.decoded_response_content_length',
  'http.response_transfer_size',
];

function partitionSizes(data: RawSpanType['data']): {
  nonSizeKeys: {[key: string]: unknown};
  sizeKeys: {[key: string]: number};
} {
  if (!data) {
    return {
      sizeKeys: {},
      nonSizeKeys: {},
    };
  }
  const sizeKeys = SIZE_DATA_KEYS.reduce((keys, key) => {
    if (data.hasOwnProperty(key) && defined(data[key])) {
      try {
        keys[key] = parseFloat(data[key]);
      } catch (e) {
        keys[key] = data[key];
      }
    }
    return keys;
  }, {});

  const nonSizeKeys = {...data};
  SIZE_DATA_KEYS.forEach(key => delete nonSizeKeys[key]);

  return {
    sizeKeys,
    nonSizeKeys,
  };
}

function getSpanTimeWindow(timestamp: number) {
  // Convert 30 minutes to miliseconds
  const thirtyMinutesInMiliSeconds = 30 * 60 * 1000;

  // Calculate the start and end of the time window
  const startTime = timestamp - thirtyMinutesInMiliSeconds;
  const endTime = timestamp + thirtyMinutesInMiliSeconds;

  return {
    startTime: startTime,
    endTime: endTime,
  };
}

function getNonSizeKeyActionData({
  organization,
  extractionRules,
  spanAttribute,
  projectId,
  spanTimestamp,
}: {
  organization: Organization;
  spanAttribute: string;
  spanTimestamp: number;
  extractionRules?: MetricsExtractionRule[];
  projectId?: string;
}): Pick<KeyValueListDataItem, 'actionButton' | 'actionButtonAlwaysVisible'> {
  if (!hasCustomMetricsExtractionRules(organization)) {
    return {};
  }

  const extractionRule = extractionRules?.find(
    rule => rule.spanAttribute === spanAttribute
  );

  if (extractionRule) {
    const virtualMRI = createVirtualMRI(extractionRule);
    const spanTimeWindow = getSpanTimeWindow(spanTimestamp * 1000);
    return {
      actionButton: (
        <Link
          to={getMetricsUrl(organization.slug, {
            start: getUtcDateString(spanTimeWindow.startTime),
            end: getUtcDateString(spanTimeWindow.endTime),
            project: [extractionRule.projectId],
            widgets: [
              {
                mri: virtualMRI,
                displayType: MetricDisplayType.BAR,
                aggregation: extractionRule.aggregates[0],
                query: '',
                groupBy: undefined,
                condition: extractionRule.conditions[0].id,
              },
            ],
          })}
        >
          {t('Open in Metrics')}
        </Link>
      ),
      actionButtonAlwaysVisible: true,
    };
  }

  return {
    actionButton: (
      <Button
        borderless
        aria-label={t('Extract as metric')}
        onClick={() =>
          openExtractionRuleCreateModal({
            organization,
            projectId: projectId,
            source: 'trace-view.span-attribute',
            initialData: {
              spanAttribute,
            },
          })
        }
        size="zero"
        icon={<IconAdd size="xs" />}
        title={t('Extract as metric')}
      />
    ),
    actionButtonAlwaysVisible: false,
  };
}

export function SpanKeys({
  node,
  projectId,
}: {
  node: TraceTreeNode<TraceTree.Span>;
  projectId?: string;
}) {
  const organization = useOrganization();
  const {data: extractionRules} = useMetricsExtractionRules({
    orgId: organization.slug,
    projectId,
  });

  const span = node.value;
  const {sizeKeys, nonSizeKeys} = partitionSizes(span?.data ?? {});
  const allZeroSizes = SIZE_DATA_KEYS.map(key => sizeKeys[key]).every(
    value => value === 0
  );
  const unknownKeys = Object.keys(span).filter(key => {
    return !isHiddenDataKey(key) && !rawSpanKeys.has(key as any);
  });

  const timingKeys = getSpanSubTimings(span) ?? [];
  const items: SectionCardKeyValueList = [];

  const aggregateMeasurements: SectionCardKeyValueList = useMemo(() => {
    if (!/^ai\.pipeline($|\.)/.test(node.value.op ?? '')) {
      return [];
    }

    let sum = 0;
    TraceTreeNode.ForEachChild(node, n => {
      if (
        isSpanNode(n) &&
        typeof n?.value?.measurements?.ai_total_tokens_used?.value === 'number'
      ) {
        sum += n.value.measurements.ai_total_tokens_used.value;
      }
    });
    return [
      {
        key: 'ai.pipeline',
        subject: 'sum(ai_total_tokens_used)',
        value: sum,
      },
    ];
  }, [node]);

  if (allZeroSizes) {
    items.push({
      key: 'all_zeros_text',
      subject: t('Timing-Allow-Origin'),
      subjectNode: null,
      value: tct(
        ' The following sizes were not collected for security reasons. Check if the host serves the appropriate [link] header. You may have to enable this collection manually.',
        {
          link: (
            <ExternalLink href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Timing-Allow-Origin">
              <span className="val-string">Timing-Allow-Origin</span>
            </ExternalLink>
          ),
        }
      ),
    });
  }
  Object.entries(sizeKeys).forEach(([key, value]) => {
    items.push({
      key: key,
      subject: key,
      value: (
        <Fragment>
          <FileSize bytes={value} />
          {value >= 1024 && <span>{` (${value} B)`}</span>}
        </Fragment>
      ),
    });
  });
  Object.entries(nonSizeKeys).forEach(([key, value]) => {
    if (!isHiddenDataKey(key)) {
      items.push({
        key: key,
        subject: key,
        value: value as string | number,
        ...getNonSizeKeyActionData({
          organization,
          extractionRules,
          spanAttribute: key,
          projectId,
          spanTimestamp: span.timestamp,
        }),
      });
    }
  });
  unknownKeys.forEach(key => {
    if (key !== 'event' && key !== 'childTransactions') {
      items.push({
        key: key,
        subject: key,
        value: span[key],
      });
    }
  });
  timingKeys.forEach(timing => {
    items.push({
      key: timing.name,
      subject: toTitleCase(timing.name),
      subjectNode: (
        <TraceDrawerComponents.FlexBox style={{gap: space(0.5)}}>
          <RowTimingPrefix timing={timing} />
          {timing.name}
        </TraceDrawerComponents.FlexBox>
      ),
      value: getPerformanceDuration(Number(timing.duration) * 1000),
    });
  });

  return (
    <TraceDrawerComponents.SectionCard
      items={[...items, ...aggregateMeasurements]}
      title={t('Additional Data')}
      sortAlphabetically
    />
  );
}

function RowTimingPrefix({timing}: {timing: SubTimingInfo}) {
  return <OpsDot style={{backgroundColor: timing.color}} />;
}
