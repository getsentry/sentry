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
      operand: jsonPathOperand,
      operator: comparison,
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

// Matched as text rather than with URL(), which rejects half-typed URLs. Like
// browsers, treats everything before the last @ in the authority as credentials.
function withoutUserInfo(url: unknown) {
  return typeof url === 'string'
    ? url.replace(/^(\s*(?:[a-z][\w+.-]*:)?[/\\]+)?[^/?#\\]*@/i, '$1')
    : url;
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
  // Headers and body aren't in the shape since they often hold credentials;
  // this strips any username and password from the URL for the same reason.
  redact: values => ({...values, url: withoutUserInfo(values.url)}),
};
