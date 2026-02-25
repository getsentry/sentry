import {Tooltip} from '@sentry/scraps/tooltip';

import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {
  AssertionErrorKind,
  CompilationErrorType,
  OpType,
  PreviewCheckStatusReasonType,
  RuntimeErrorType,
  type AndOp,
  type Assertion,
  type GroupOp,
  type NotOp,
  type Op,
  type PreviewCheckCompilationError,
  type PreviewCheckResult,
} from 'sentry/views/alerts/rules/uptime/types';
import {isLeafOp, leafOpsMatch} from 'sentry/views/alerts/rules/uptime/assertions/utils';

/**
 * Maps assertion error types to user-friendly titles.
 */
function getAssertionErrorTitle(errorType: string): string {
  switch (errorType) {
    case 'compilation_error':
      return t('Compilation Error');
    case 'serialization_error':
      return t('Serialization Error');
    default:
      return t('Validation Error');
  }
}

/**
 * Checks if an object is an assertion error with error type and details.
 */
function isAssertionError(obj: unknown): obj is {details: string; error: string} {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    !Array.isArray(obj) &&
    'details' in obj &&
    'error' in obj
  );
}

/**
 * Formats an assertion error into a user-friendly message.
 */
function formatAssertionError(assertionError: {
  details: string;
  error: string;
}): string[] {
  const title = getAssertionErrorTitle(assertionError.error);
  return [`${title}: ${assertionError.details}`];
}

/**
 * Maps form errors from the API response format to the format expected by FormModel.
 *
 * Handles assertion errors in two formats:
 *
 * 1. Direct format (uptime alerts):
 *    {"assertion": {"error": "compilation_error", "details": "..."}}
 *
 * 2. Nested format (detector forms):
 *    {"dataSources": {"assertion": {"error": "compilation_error", "details": "..."}}}
 *
 * Both are transformed to: {"assertion": ["Compilation Error: <error details>"]}
 */
export function mapAssertionFormErrors(responseJson: any): any {
  if (!responseJson) {
    return responseJson;
  }

  const result = {...responseJson};

  // Handle direct assertion errors (uptime alerts endpoint)
  if (isAssertionError(result.assertion)) {
    result.assertion = formatAssertionError(result.assertion);
  }

  // Handle nested errors from detector forms endpoint
  // e.g. {"dataSources": {"url": ["Enter a valid URL."], "assertion": {...}}}
  if (result.dataSources) {
    const handledAssertion = isAssertionError(result.dataSources.assertion);
    if (handledAssertion) {
      result.assertion = formatAssertionError(result.dataSources.assertion);
    }

    // Flatten remaining dataSources fields to top level so FormModel can
    // map them to the corresponding form fields. Only exclude assertion
    // from flattening if it was handled as an assertion error above —
    // otherwise it may be a plain validation error array that should be kept.
    if (handledAssertion) {
      const {assertion: _, ...remainingDataSources} = result.dataSources;
      Object.assign(result, remainingDataSources);
    } else {
      Object.assign(result, result.dataSources);
    }
    delete result.dataSources;
  }

  return result;
}

/**
 * Extracts a PreviewCheckCompilationError from API error response JSON.
 *
 * Handles two formats:
 *
 * 1. Direct format (uptime alerts test button / form submission):
 *    {"assertion": {"error": "compilation_error", ...}}
 *
 * 2. Nested format (detector form submission):
 *    {"dataSources": {"assertion": {"error": "compilation_error", ...}}}
 */
export function extractCompilationError(
  responseJson: any
): PreviewCheckCompilationError | null {
  if (!responseJson) {
    return null;
  }

  // Nested detector format: {dataSources: {assertion: {...}}}
  if (responseJson.dataSources?.assertion) {
    return {assertion: responseJson.dataSources.assertion};
  }

  // Direct format: {assertion: {...}}
  if (responseJson.assertion && !Array.isArray(responseJson.assertion)) {
    return {assertion: responseJson.assertion};
  }

  return null;
}

const PREVIEW_CHECK_STATUS_REASON_LABELS: Record<PreviewCheckStatusReasonType, string> =
  {
    [PreviewCheckStatusReasonType.TIMEOUT]: t('Timeout'),
    [PreviewCheckStatusReasonType.DNS_ERROR]: t('DNS Error'),
    [PreviewCheckStatusReasonType.TLS_ERROR]: t('TLS Error'),
    [PreviewCheckStatusReasonType.CONNECTION_ERROR]: t('Connection Error'),
    [PreviewCheckStatusReasonType.REDIRECT_ERROR]: t('Redirect Error'),
    [PreviewCheckStatusReasonType.FAILURE]: t('Failure'),
    [PreviewCheckStatusReasonType.MISS_PRODUCED]: t('Missed Window'),
    [PreviewCheckStatusReasonType.MISS_BACKFILL]: t('Missed Window'),
    [PreviewCheckStatusReasonType.ASSERTION_COMPILATION_ERROR]: t(
      'Assertions Compilation Error'
    ),
    [PreviewCheckStatusReasonType.ASSERTION_EVALUATION_ERROR]: t(
      'Assertions Evaluation Error'
    ),
  };

export function mapPreviewCheckErrorToMessage(
  error: PreviewCheckCompilationError
): string {
  return error.assertion.error === AssertionErrorKind.COMPILATION_ERROR
    ? t('Assertions Compilation Error')
    : t('Assertions Serialization Error');
}

export function mapPreviewCheckResponseToMessage(
  response: PreviewCheckResult
): string | null {
  const result = response.check_result;
  if (!result) return null;

  if (result.assertion_failure_data) {
    return t('Assertions Failure');
  }

  const type = result.status_reason?.type;
  return type ? (PREVIEW_CHECK_STATUS_REASON_LABELS[type] ?? null) : null;
}

// --- Op resolution helpers ---

// Walk failure_data and rootOp to find the errored leaf.
// failure_data contains only ONE child at each AND/OR level (the failing branch),
// so we find the matching sibling in rootOp by op type + value rather than by index.
function matchOpNode(first: Op, second: Op): Op | null {
  if (isLeafOp(first)) {
    return second;
  }

  if (
    (first.op === OpType.AND || first.op === OpType.OR) &&
    (second.op === OpType.AND || second.op === OpType.OR)
  ) {
    const [failingChild] = (first as GroupOp).children;
    if (!failingChild) return null;
    // For leaves, also match by value to distinguish siblings of the same op type.
    const match = (second as GroupOp).children.find(
      c =>
        c.op === failingChild.op &&
        (isLeafOp(failingChild) ? leafOpsMatch(failingChild, c) : true)
    );
    if (!match) return null;
    return matchOpNode(failingChild, match);
  }

  // NOT wraps a group op in `operand`; descend into it for both sides
  if (first.op === OpType.NOT && second.op === OpType.NOT) {
    return matchOpNode((first as NotOp).operand, (second as NotOp).operand);
  }

  return null;
}

/**
 * assertion_failure_data mirrors rootOp's structure without ids.
 * Walk both trees by position to find the errored leaf in rootOp.
 */
function resolveOpFromFailureData(failureData: Assertion, rootOp: AndOp): Op | null {
  return matchOpNode(failureData.root, rootOp);
}

/**
 * assertPath is ["groupPos", "childIndex", "groupPos", "childIndex", ...].
 * The first segment identifies the root group itself (not a child), so we skip it.
 * e.g. ["0", "2", "0"] -> children[2] -> children[0]
 */
function resolveOpFromAssertPath(assertPath: string[], rootOp: AndOp): Op | null {
  let current: Op = rootOp;

  for (const segment of assertPath.slice(1)) {
    const index = parseInt(segment, 10);
    if (current.op === OpType.AND || current.op === OpType.OR) {
      const next: Op | undefined = (current as GroupOp).children[index];
      if (!next) return null;
      current = next;
    } else if (current.op === OpType.NOT) {
      current = (current as NotOp).operand;
    } else {
      // Already at a leaf — the remaining path segments index into the op's
      // operands, which we don't need. Return the leaf as the errored op.
      return current;
    }
  }

  return current;
}

/**
 * Given the preview check results state and the current assertion tree, returns
 * the specific Op that caused the failure, or null if one cannot be identified.
 */
export function resolveErroredOp(
  state: {data: PreviewCheckResult | null; error: PreviewCheckCompilationError | null},
  rootOp: AndOp
): Op | null {
  if (state.data) {
    const result = state.data.check_result;
    if (!result) return null;

    if (result.assertion_failure_data) {
      return resolveOpFromFailureData(result.assertion_failure_data, rootOp);
    }

    // No failure data; fall back to status_reason details if they carry an assertPath
    const {details} = result.status_reason ?? {};
    if (details && 'assertPath' in details) {
      return resolveOpFromAssertPath(details.assertPath, rootOp);
    }

    return null;
  }

  if (state.error) {
    const {assertion} = state.error;
    if (assertion.error === AssertionErrorKind.COMPILATION_ERROR) {
      return resolveOpFromAssertPath(assertion.compileError.assertPath, rootOp);
    }
  }

  return null;
}

const ASSERTION_ERROR_TYPE_LABELS: Partial<Record<string, string>> = {
  [CompilationErrorType.INVALID_GLOB]: t('Invalid Glob'),
  [CompilationErrorType.JSON_PATH_PARSER]: t('JSONPath Parser Error'),
  [CompilationErrorType.INVALID_JSON_PATH]: t('Invalid JSON Path'),
  [CompilationErrorType.TOO_MANY_OPERATIONS]: t('Too Many Operations'),
  [RuntimeErrorType.TOOK_TOO_LONG]: t('Took Too Long'),
  [RuntimeErrorType.INVALID_JSON_BODY]: t('Invalid JSON Body'),
  [RuntimeErrorType.INVALID_TYPE_COMPARISON]: t('Invalid Type Comparison'),
};

function getAssertionFormErrorMessage(
  state: {data: PreviewCheckResult | null; error: PreviewCheckCompilationError | null}
): string | null {
  if (state.data) {
    const result = state.data.check_result;
    if (!result) return null;

    if (result.assertion_failure_data) {
      return t('Assertion Failed');
    }

    const details = result.status_reason?.details;
    if (details && 'type' in details) {
      const label =
        ASSERTION_ERROR_TYPE_LABELS[
          details.type as CompilationErrorType | RuntimeErrorType
        ] ?? details.type;
      return 'msg' in details ? `${label}: ${details.msg}` : label;
    }

    return null;
  }

  if (state.error) {
    const {assertion} = state.error;
    if (assertion.error === AssertionErrorKind.COMPILATION_ERROR) {
      const {compileError} = assertion;
      const label = ASSERTION_ERROR_TYPE_LABELS[compileError.type] ?? compileError.type;
      return 'msg' in compileError ? `${label}: ${compileError.msg}` : label;
    } else if (assertion.error === AssertionErrorKind.SERIALIZATION_ERROR) {
      return t('Serialization Error: %s', assertion.details);
    }
  }

  return null;
}

interface AssertionFormErrorProps {
  erroredOp: Op | null;
  op: Op;
  state: {data: PreviewCheckResult | null; error: PreviewCheckCompilationError | null};
}

export function AssertionFormError({op, erroredOp, state}: AssertionFormErrorProps) {
  if (!erroredOp || erroredOp.id !== op.id) {
    return null;
  }

  const message = getAssertionFormErrorMessage(state);
  if (!message) {
    return null;
  }

  return (
    <span style={{display: 'inline-flex', marginTop: 4}}>
      <Tooltip title={message} isHoverable forceVisible>
        <IconWarning variant="danger" size="sm" />
      </Tooltip>
    </span>
  );
}
