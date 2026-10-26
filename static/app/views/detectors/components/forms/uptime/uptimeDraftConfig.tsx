import omit from 'lodash/omit';
import {z} from 'zod';

import type {DetectorDraftConfig} from 'sentry/views/detectors/components/forms/common/detectorDraft';
import {draftNumber} from 'sentry/views/detectors/components/forms/common/detectorDraft';
import {
  UPTIME_HTTP_METHOD_OPTIONS,
  UPTIME_VALID_INTERVALS_SEC,
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
      // A cleared status code is NaN, which JSON writes as null. Submitting
      // normalizes it to 200 too.
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

/**
 * Half-typed URLs don't parse, so those are checked as text: an `@` or a
 * non-numeric port in the authority may be part of a username and password.
 */
function mayHoldCredentials(url: string) {
  const parsed = parseHttpUrl(url);
  if (parsed) {
    return Boolean(parsed.username || parsed.password);
  }
  const authority = /^\s*(?:[a-z][\w+.-]*:)?[/\\]*([^/?#\\]*)/i.exec(url)?.[1] ?? '';
  return authority.includes('@') || /:(?!\d*$)/.test(authority);
}

export const UPTIME_DETECTOR_DRAFT_CONFIG: DetectorDraftConfig<UptimeDetectorFormData> = {
  shape: {
    assertion: z.object({root: andOp}),
    description: z.string().nullable(),
    downtimeThreshold: draftNumber,
    environment: z.string(),
    intervalSeconds: z
      .number()
      .refine(value => UPTIME_VALID_INTERVALS_SEC.includes(value)),
    method: z.enum(UPTIME_HTTP_METHOD_OPTIONS),
    name: z.string(),
    owner: z.string(),
    projectId: z.string(),
    recoveryThreshold: draftNumber,
    timeoutMs: z.number(),
    traceSampling: z.boolean(),
    url: z.string(),
    workflowIds: z.array(z.string()),
  },
  // Headers and body aren't in the shape since they often hold credentials,
  // and a URL that may hold them is left out for the same reason.
  redact: values =>
    typeof values.url === 'string' && mayHoldCredentials(values.url)
      ? omit(values, 'url')
      : values,
};
