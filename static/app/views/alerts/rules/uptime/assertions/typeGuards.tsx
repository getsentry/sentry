import type {
  AndOp,
  HeaderCheckOp,
  JsonPathOp,
  NotOp,
  Op,
  OrOp,
  StatusCodeOp,
} from 'sentry/views/alerts/rules/uptime/types';

export function isAndOp(value: Op): value is AndOp {
  return value.op === 'and';
}

export function isOrOp(value: Op): value is OrOp {
  return value.op === 'or';
}

export function isNotOp(value: Op): value is NotOp {
  return value.op === 'not';
}

export function isStatusCodeOp(value: Op): value is StatusCodeOp {
  return value.op === 'status_code_check';
}

export function isJsonPathOp(value: Op): value is JsonPathOp {
  return value.op === 'json_path';
}

export function isHeaderCheckOp(value: Op): value is HeaderCheckOp {
  return value.op === 'header_check';
}
