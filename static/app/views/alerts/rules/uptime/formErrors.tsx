import {Container} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {
  isLeafOp,
  leafOpsMatchByValue,
} from 'sentry/views/alerts/rules/uptime/assertions/utils';
import {
  CompilationErrorType,
  PreviewCheckErrorKind,
  PreviewCheckStatusReasonType,
  RuntimeErrorType,
  UptimeOpType,
  type PreviewCheckError,
  type PreviewCheckResult,
  type UptimeAndOp,
  type UptimeOp,
} from 'sentry/views/alerts/rules/uptime/types';

import {usePreviewCheckResult} from './previewCheckContext';

export function mapPreviewCheckErrorToMessage(
  error: PreviewCheckError | null
): string | null {
  if (!error) return null;

  return error.assertion.error === PreviewCheckErrorKind.COMPILATION_ERROR
    ? t('Assertion Compilation Error')
    : t('Assertion Serialization Error');
}

function mapToFormErrors(responseJson: any) {
  if (!responseJson) {
    return responseJson;
  }

  const error = extractPreviewCheckError(responseJson);

  if (error) {
    const trailingMessage = mapPreviewCheckErrorToMessage(error);
    return {
      nonFieldErrors: [
        t('Failed to create monitor %s', trailingMessage ? `(${trailingMessage})` : ''),
      ],
    };
  }

  // Flatten dataSources fields to top level so FormModel can map them to
  // the corresponding form fields (used by the detector forms endpoint).
  if (responseJson.dataSources) {
    const {dataSources, ...rest} = responseJson;
    return {...rest, ...dataSources};
  }

  return responseJson;
}

export function createMapFormErrors(
  previewCheckResult: ReturnType<typeof usePreviewCheckResult>
) {
  return (responseJson: any) => {
    previewCheckResult?.setPreviewCheckError(extractPreviewCheckError(responseJson));
    return mapToFormErrors(responseJson);
  };
}

function isPreviewCheckError(value: any): value is PreviewCheckError {
  return (
    value !== null &&
    typeof value === 'object' &&
    'assertion' in value &&
    value.assertion !== null &&
    typeof value.assertion === 'object' &&
    'error' in value.assertion
  );
}

/**
 * Validates and extracts a PreviewCheckError from API error response JSON.
 *
 * Handles two formats:
 *
 * 1. Direct format: {...PreviewCheckError}
 *
 * 2. Nested format: {dataSources: {...PreviewCheckError}}
 */
export function extractPreviewCheckError(responseJson: any): PreviewCheckError | null {
  const candidates = [responseJson?.dataSources, responseJson];
  return candidates.find(isPreviewCheckError) ?? null;
}

const PREVIEW_CHECK_STATUS_REASON_LABELS: Record<PreviewCheckStatusReasonType, string> = {
  [PreviewCheckStatusReasonType.TIMEOUT]: t('Timeout'),
  [PreviewCheckStatusReasonType.DNS_ERROR]: t('DNS Error'),
  [PreviewCheckStatusReasonType.TLS_ERROR]: t('TLS Error'),
  [PreviewCheckStatusReasonType.CONNECTION_ERROR]: t('Connection Error'),
  [PreviewCheckStatusReasonType.REDIRECT_ERROR]: t('Redirect Error'),
  [PreviewCheckStatusReasonType.FAILURE]: t('Failure'),
  [PreviewCheckStatusReasonType.MISS_PRODUCED]: t('Missed Window'),
  [PreviewCheckStatusReasonType.MISS_BACKFILL]: t('Missed Window'),
  [PreviewCheckStatusReasonType.ASSERTION_COMPILATION_ERROR]: t(
    'Assertion Compilation Error'
  ),
  [PreviewCheckStatusReasonType.ASSERTION_EVALUATION_ERROR]: t(
    'Assertion Evaluation Error'
  ),
};

export function mapPreviewCheckResultToMessage(
  response: PreviewCheckResult
): string | null {
  const result = response.check_result;
  if (!result) return null;

  if (result.assertion_failure_data) {
    return t('Assertion Failure');
  }

  const type = result.status_reason?.type;
  return type ? (PREVIEW_CHECK_STATUS_REASON_LABELS[type] ?? null) : null;
}

// Matches a leaf op from the failure data op tree (pointing to the failing assertion)
// to an op from the form's assertion op tree.
function matchAssertionFailureDataLeafOp(
  failureDataOp: UptimeOp,
  assertionOp: UptimeOp
): UptimeOp | null {
  if (isLeafOp(failureDataOp)) {
    return assertionOp;
  }

  if (
    (failureDataOp.op === UptimeOpType.AND || failureDataOp.op === UptimeOpType.OR) &&
    (assertionOp.op === UptimeOpType.AND || assertionOp.op === UptimeOpType.OR)
  ) {
    const [failingChild] = failureDataOp.children;
    if (!failingChild) return null;
    // For leaves, also match by value to distinguish siblings of the same op type.
    const match = assertionOp.children.find(
      c =>
        c.op === failingChild.op &&
        (isLeafOp(failingChild) ? leafOpsMatchByValue(failingChild, c) : true)
    );
    if (!match) return null;
    return matchAssertionFailureDataLeafOp(failingChild, match);
  }

  // NOT wraps a group op in `operand`; descend into it for both sides
  if (failureDataOp.op === UptimeOpType.NOT && assertionOp.op === UptimeOpType.NOT) {
    return matchAssertionFailureDataLeafOp(failureDataOp.operand, assertionOp.operand);
  }

  return null;
}

function resolveErroredOpFromAssertionFailureData(
  failureDataOp: UptimeAndOp,
  rootOp: UptimeAndOp
): UptimeOp | null {
  return matchAssertionFailureDataLeafOp(failureDataOp, rootOp);
}

// Maps the assert path to the op in the form's assertion op tree.
// Examples: assertPath = ["0", "0", "1"] points to:
// first child of root: call it A -> first child of A: call it B -> second child of B
function resolveErroredOpFromAssertPath(
  assertPath: string[],
  rootOp: UptimeAndOp
): UptimeOp | null {
  let current: UptimeOp = rootOp;

  for (const segment of assertPath.slice(1)) {
    const index = Number.parseInt(segment, 10);
    if (isNaN(index)) return null;

    if (current.op === UptimeOpType.AND || current.op === UptimeOpType.OR) {
      const next: UptimeOp | undefined = current.children[index];
      if (!next) return null;
      current = next;
    } else if (current.op === UptimeOpType.NOT) {
      current = current.operand;
    } else {
      // At a leaf op; return it as the errored op.
      return current;
    }
  }

  return current;
}

/**
 * Given the preview check results state and the current assertion tree, returns
 * the specific Op that caused the failure, or null if one cannot be identified.
 */
export function resolveErroredAssertionOp(
  previewCheckResult: ReturnType<typeof usePreviewCheckResult>,
  rootOp: UptimeAndOp
): UptimeOp | null {
  if (!previewCheckResult) return null;
  const {data, error} = previewCheckResult;

  if (data) {
    const result = data.check_result;
    if (!result) return null;

    if (result.assertion_failure_data) {
      return resolveErroredOpFromAssertionFailureData(
        result.assertion_failure_data.root,
        rootOp
      );
    }

    // No failure data; fall back to status_reason details if they carry an assertPath
    const {details} = result.status_reason ?? {};
    if (details && 'assertPath' in details) {
      return resolveErroredOpFromAssertPath(details.assertPath, rootOp);
    }

    return null;
  }

  if (error) {
    const {assertion} = error;
    if (assertion.error === PreviewCheckErrorKind.COMPILATION_ERROR) {
      return resolveErroredOpFromAssertPath(assertion.compileError.assertPath, rootOp);
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

function getFormAssertionErrorMessage(
  previewCheckResult: ReturnType<typeof usePreviewCheckResult>
): string | null {
  if (!previewCheckResult) return null;
  const {data, error} = previewCheckResult;

  if (data) {
    const result = data.check_result;
    if (!result) return null;

    if (result.assertion_failure_data) {
      return t('Assertion Failed');
    }

    const details = result.status_reason?.details;
    if (details) {
      const label = ASSERTION_ERROR_TYPE_LABELS[details.type] ?? details.type;
      return 'msg' in details ? `${label}: ${details.msg}` : label;
    }

    return null;
  }

  if (error) {
    const {assertion} = error;
    if (assertion.error === PreviewCheckErrorKind.COMPILATION_ERROR) {
      const {compileError} = assertion;
      const label = ASSERTION_ERROR_TYPE_LABELS[compileError.type] ?? compileError.type;
      return 'msg' in compileError ? `${label}: ${compileError.msg}` : label;
    }
    if (assertion.error === PreviewCheckErrorKind.SERIALIZATION_ERROR) {
      return t('Serialization Error: %s', assertion.details);
    }
  }

  return null;
}

interface AssertionFormErrorProps {
  erroredOp: UptimeOp | undefined;
  op: UptimeOp;
}

export function AssertionFormError({op, erroredOp}: AssertionFormErrorProps) {
  const previewCheckResult = usePreviewCheckResult();

  if (!previewCheckResult || erroredOp?.id !== op.id) {
    return null;
  }

  const message = getFormAssertionErrorMessage(previewCheckResult);
  if (!message) {
    return null;
  }

  return (
    <Container marginTop="xs">
      <Tooltip title={message} isHoverable forceVisible overlayStyle={{zIndex: 1}}>
        <IconWarning variant="danger" size="sm" />
      </Tooltip>
    </Container>
  );
}
