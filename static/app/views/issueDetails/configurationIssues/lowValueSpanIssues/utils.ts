import {t} from 'sentry/locale';
import type {EventOccurrence} from 'sentry/types/event';
import type {PlatformKey} from 'sentry/types/platform';

import type {LowValueSpanEvidenceData} from './types';

type LowValueSpanEvidencePayload = Partial<{
  analysisEnd: unknown;
  analysisStart: unknown;
  avgDurationMs: unknown;
  count: unknown;
  description: unknown;
  extrapolatedCount: unknown;
  op: unknown;
  spanOrigin: unknown;
  valueScore: unknown;
}>;

function getStringValue(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }
  return value;
}

function getNumberValue(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

export function getLowValueSpanEvidenceData(
  evidenceData: EventOccurrence['evidenceData'] | null | undefined
): LowValueSpanEvidenceData {
  const data = evidenceData as LowValueSpanEvidencePayload | null | undefined;

  return {
    op: getStringValue(data?.op),
    description: getStringValue(data?.description),
    count: getNumberValue(data?.count),
    extrapolatedCount: getNumberValue(data?.extrapolatedCount),
    avgDurationMs: getNumberValue(data?.avgDurationMs),
    spanOrigin: getStringValue(data?.spanOrigin),
  };
}

const JAVASCRIPT_SPAN_FILTERING_DOCS_URL =
  'https://docs.sentry.io/platforms/javascript/configuration/options/#ignoreSpans';
const PYTHON_SPAN_FILTERING_DOCS_URL =
  'https://docs.sentry.io/platforms/python/configuration/filtering/#filtering-transaction-events';
const GENERIC_FILTERING_DOCS_URL =
  'https://docs.sentry.io/platform-redirect/?next=/configuration/filtering/';
const CUSTOM_INSTRUMENTATION_DOCS_URL =
  'https://docs.sentry.io/platform-redirect/?next=/tracing/instrumentation/custom-instrumentation/';
const JAVASCRIPT_PROJECT_PLATFORMS = new Set<PlatformKey>([
  'bun',
  'capacitor',
  'cordova',
  'deno',
  'electron',
  'ionic',
  'react',
  'react-native',
]);

export function getSpanLabel(evidenceData: LowValueSpanEvidenceData): string {
  const {op, description} = evidenceData;

  if (op && description) {
    return `${op} - ${description}`;
  }
  if (op) {
    return op;
  }
  if (description) {
    return description;
  }
  return t('Unknown span');
}

export function formatDurationMs(duration: number | null): string {
  if (duration === null) {
    return t('Unknown');
  }
  if (duration < 1) {
    return t('<1ms');
  }
  return t('%sms', duration.toFixed(1));
}

export function formatEstimatedCostUsd(estimatedCostUsd: number | null): string {
  if (estimatedCostUsd === null) {
    return t('Unknown');
  }
  if (estimatedCostUsd > 0 && estimatedCostUsd < 0.01) {
    return t('<$0.01');
  }
  return estimatedCostUsd.toLocaleString(undefined, {
    currency: 'USD',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: 'currency',
  });
}

export function isPythonProjectPlatform(projectPlatform?: PlatformKey | null): boolean {
  if (projectPlatform === null || projectPlatform === undefined) {
    return false;
  }

  return projectPlatform.startsWith('python');
}

export function isJavaScriptProjectPlatform(
  projectPlatform?: PlatformKey | null
): boolean {
  if (projectPlatform === null || projectPlatform === undefined) {
    return false;
  }

  return (
    projectPlatform.startsWith('javascript') ||
    projectPlatform.startsWith('node') ||
    JAVASCRIPT_PROJECT_PLATFORMS.has(projectPlatform)
  );
}

export function getSpanFilteringDocsUrl(projectPlatform?: PlatformKey | null): string {
  if (isPythonProjectPlatform(projectPlatform)) {
    return PYTHON_SPAN_FILTERING_DOCS_URL;
  }
  if (isJavaScriptProjectPlatform(projectPlatform)) {
    return JAVASCRIPT_SPAN_FILTERING_DOCS_URL;
  }
  return GENERIC_FILTERING_DOCS_URL;
}

export function getCustomInstrumentationDocsUrl(): string {
  return CUSTOM_INSTRUMENTATION_DOCS_URL;
}

export function getJavaScriptSpanFilterSnippet(
  evidenceData: LowValueSpanEvidenceData
): string {
  const matcherLines: string[] = [];
  if (evidenceData.description === null && evidenceData.op !== null) {
    matcherLines.push(`      // NOTE: This span has no description, so it can only be`);
    matcherLines.push(
      `      // targeted by op. This will also drop other spans with this op.`
    );
  }
  if (evidenceData.op !== null) {
    matcherLines.push(`      op: ${JSON.stringify(evidenceData.op)},`);
  }
  if (evidenceData.description !== null) {
    matcherLines.push(`      name: ${JSON.stringify(evidenceData.description)},`);
  }

  return `Sentry.init({
  ignoreSpans: [
    {
${matcherLines.join('\n')}
    },
  ],
});`;
}

export function getPythonSpanFilterSnippet(
  evidenceData: LowValueSpanEvidenceData
): string {
  const conditions: string[] = [];
  if (evidenceData.op === null) {
    conditions.push(`            span.get("op") is None`);
  } else {
    conditions.push(`            span.get("op") == ${JSON.stringify(evidenceData.op)}`);
  }
  if (evidenceData.description === null) {
    conditions.push(`            and span.get("description") is None`);
  } else {
    conditions.push(
      `            and span.get("description") == ${JSON.stringify(evidenceData.description)}`
    );
  }

  return `import sentry_sdk


def before_send_transaction(event, hint):
    reparent = {}
    kept_spans = []
    # Filtering span and rewriting parent_id
    for span in event.get("spans", []):
        parent = span.get("parent_span_id")
        while parent in reparent:
            parent = reparent[parent]
        if (
${conditions.join('\n')}
        ):
            reparent[span.get("span_id")] = parent
        else:
            span["parent_span_id"] = parent
            kept_spans.append(span)

    event["spans"] = kept_spans
    return event


sentry_sdk.init(
    before_send_transaction=before_send_transaction,
)`;
}
