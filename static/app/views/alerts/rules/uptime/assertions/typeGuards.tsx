import {
  UptimeOpType,
  type UptimeAndOp,
  type UptimeGroupOp,
  type UptimeHeaderCheckOp,
  type UptimeJsonPathOp,
  type UptimeNotOp,
  type UptimeOp,
  type UptimeOrOp,
  type UptimeStatusCodeOp,
} from 'sentry/views/alerts/rules/uptime/types';

export function isAndOp(value: UptimeOp): value is UptimeAndOp {
  return value.op === UptimeOpType.AND;
}

export function isOrOp(value: UptimeOp): value is UptimeOrOp {
  return value.op === UptimeOpType.OR;
}

export function isGroupOp(value: UptimeOp): value is UptimeGroupOp {
  return isAndOp(value) || isOrOp(value);
}

export function isNotOp(value: UptimeOp): value is UptimeNotOp {
  return value.op === UptimeOpType.NOT;
}

export function isStatusCodeOp(value: UptimeOp): value is UptimeStatusCodeOp {
  return value.op === UptimeOpType.STATUS_CODE_CHECK;
}

export function isJsonPathOp(value: UptimeOp): value is UptimeJsonPathOp {
  return value.op === UptimeOpType.JSON_PATH;
}

export function isHeaderCheckOp(value: UptimeOp): value is UptimeHeaderCheckOp {
  return value.op === UptimeOpType.HEADER_CHECK;
}
