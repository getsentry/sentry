import {
  OpType,
  type AndOp,
  type GroupOp,
  type HeaderCheckOp,
  type JsonPathOp,
  type NotOp,
  type Op,
  type OrOp,
  type StatusCodeOp,
} from 'sentry/views/alerts/rules/uptime/types';

export function isAndOp(value: Op): value is AndOp {
  return value.op === OpType.AND;
}

export function isOrOp(value: Op): value is OrOp {
  return value.op === OpType.OR;
}

export function isGroupOp(value: Op): value is GroupOp {
  return isAndOp(value) || isOrOp(value);
}

export function isNotOp(value: Op): value is NotOp {
  return value.op === OpType.NOT;
}

export function isStatusCodeOp(value: Op): value is StatusCodeOp {
  return value.op === OpType.STATUS_CODE_CHECK;
}

export function isJsonPathOp(value: Op): value is JsonPathOp {
  return value.op === OpType.JSON_PATH;
}

export function isHeaderCheckOp(value: Op): value is HeaderCheckOp {
  return value.op === OpType.HEADER_CHECK;
}
