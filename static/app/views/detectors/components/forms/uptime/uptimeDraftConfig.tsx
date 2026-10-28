import {z} from 'zod';

import type {UptimeDetector} from 'sentry/types/workflowEngine/detectors';
import {
  draftDescription,
  draftField,
  draftNumber,
  type DetectorDraftSchema,
} from 'sentry/views/detectors/components/forms/common/detectorDraft';
import {
  UPTIME_HTTP_METHOD_OPTIONS,
  UPTIME_VALID_INTERVALS_SEC,
  uptimeSavedDetectorToFormData,
  type UptimeDetectorFormData,
} from 'sentry/views/detectors/components/forms/uptime/fields';
import {
  UptimeComparisonType,
  UptimeOpType,
  type UptimeAndOp,
  type UptimeHeaderOperand,
  type UptimeJsonPathOperand,
  type UptimeOp,
} from 'sentry/views/detectors/components/uptime/types';

const comparison = z.object({cmp: z.enum(UptimeComparisonType)});

const headerOperand: z.ZodType<UptimeHeaderOperand> = z.discriminatedUnion('header_op', [
  z.object({header_op: z.literal('none')}),
  z.object({header_op: z.literal('literal'), value: z.string()}),
  z.object({header_op: z.literal('glob'), pattern: z.object({value: z.string()})}),
]);

const jsonPathOperand: z.ZodType<UptimeJsonPathOperand> = z.discriminatedUnion(
  'jsonpath_op',
  [
    z.object({jsonpath_op: z.literal('none')}),
    z.object({jsonpath_op: z.literal('literal'), value: z.string()}),
    z.object({jsonpath_op: z.literal('glob'), pattern: z.object({value: z.string()})}),
  ]
);

const andOp: z.ZodType<UptimeAndOp> = z.lazy(() =>
  z.object({id: z.string(), op: z.literal(UptimeOpType.AND), children: z.array(op)})
);

const op: z.ZodType<UptimeOp> = z.lazy(() =>
  z.union([
    andOp,
    z.object({id: z.string(), op: z.literal(UptimeOpType.OR), children: z.array(op)}),
    z.object({id: z.string(), op: z.literal(UptimeOpType.NOT), operand: op}),
    z.object({
      id: z.string(),
      op: z.literal(UptimeOpType.STATUS_CODE_CHECK),
      operator: comparison,
      // A cleared status code (NaN) is null in JSON; submitting maps it to 200.
      value: z.union([z.number(), z.null().transform(() => 200)]),
    }),
    z.object({
      id: z.string(),
      op: z.literal(UptimeOpType.JSON_PATH),
      // Legacy ops may lack these, matching normalizeJsonPathOp.
      operand: jsonPathOperand.default({jsonpath_op: 'literal', value: ''}),
      operator: comparison.default({cmp: UptimeComparisonType.EQUALS}),
      value: z.string(),
    }),
    z.object({
      id: z.string(),
      op: z.literal(UptimeOpType.HEADER_CHECK),
      key_op: comparison,
      key_operand: headerOperand,
      value_op: comparison,
      value_operand: headerOperand,
    }),
  ])
);

function parseHttpUrl(url: string) {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed : null;
  } catch {
    return null;
  }
}

// Half-typed URLs don't parse, so look for an `@` or non-numeric port as text.
function mayHoldCredentials(url: string) {
  const parsed = parseHttpUrl(url);
  if (parsed) {
    return Boolean(parsed.username || parsed.password);
  }
  const authority =
    /^\s*(?:[a-z][\w+.-]*:(?=[/\\]))?[/\\]*([^/?#\\]*)/i.exec(url)?.[1] ?? '';
  return authority.includes('@') || /:(?!\d*$)/.test(authority);
}

export const UPTIME_DETECTOR_DRAFT_SCHEMA: DetectorDraftSchema<UptimeDetectorFormData> =
  z.object({
    assertion: draftField(z.object({root: andOp})),
    description: draftField(draftDescription),
    downtimeThreshold: draftField(draftNumber),
    environment: draftField(z.string()),
    intervalSeconds: draftField(
      z.number().refine(value => UPTIME_VALID_INTERVALS_SEC.includes(value))
    ),
    method: draftField(z.enum(UPTIME_HTTP_METHOD_OPTIONS)),
    name: draftField(z.string()),
    owner: draftField(z.string()),
    projectId: draftField(z.string()),
    recoveryThreshold: draftField(draftNumber),
    timeoutMs: draftField(z.number()),
    traceSampling: draftField(z.boolean()),
    // Headers and body are left out since they often hold credentials.
    url: draftField(z.string().refine(value => !mayHoldCredentials(value))),
    workflowIds: draftField(z.array(z.string())),
  });

function isSameUrl(a: string, b: string) {
  try {
    return new URL(a.trim()).href === new URL(b.trim()).href;
  } catch {
    return false;
  }
}

// A draft that changes the request mustn't reuse the source's headers and body.
export function getUptimeDuplicateFormData(
  duplicateDetector: UptimeDetector,
  draftValues: Record<string, unknown> | undefined
): UptimeDetectorFormData {
  const formData = uptimeSavedDetectorToFormData(duplicateDetector);
  const {method, projectId, url} = draftValues
    ? UPTIME_DETECTOR_DRAFT_SCHEMA.parse(draftValues)
    : {};
  const isSameRequest =
    (url === undefined || isSameUrl(url, formData.url)) &&
    (method === undefined || method === formData.method) &&
    (projectId === undefined || projectId === formData.projectId);
  return isSameRequest ? formData : {...formData, body: '', headers: []};
}
