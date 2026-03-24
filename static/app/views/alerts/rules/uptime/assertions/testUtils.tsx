import {uniqueId} from 'sentry/utils/guid';
import {
  UptimeComparisonType,
  UptimeOpType,
  type UptimeAndOp,
  type UptimeHeaderCheckOp,
  type UptimeJsonPathOp,
  type UptimeNotOp,
  type UptimeOrOp,
  type UptimeStatusCodeOp,
} from 'sentry/views/alerts/rules/uptime/types';

export function makeAndOp(overrides: Omit<Partial<UptimeAndOp>, 'op'> = {}): UptimeAndOp {
  const {children, ...rest} = overrides;
  return {
    id: uniqueId(),
    op: UptimeOpType.AND,
    children: children ?? [],
    ...rest,
  };
}

export function makeOrOp(overrides: Omit<Partial<UptimeOrOp>, 'op'> = {}): UptimeOrOp {
  const {children, ...rest} = overrides;
  return {
    id: uniqueId(),
    op: UptimeOpType.OR,
    children: children ?? [],
    ...rest,
  };
}

export function makeNotOp(overrides: Omit<Partial<UptimeNotOp>, 'op'> = {}): UptimeNotOp {
  const {operand, ...rest} = overrides;
  return {
    id: uniqueId(),
    op: UptimeOpType.NOT,
    operand: operand ?? makeAndOp({children: [makeStatusCodeOp()]}),
    ...rest,
  };
}

export function makeStatusCodeOp(
  overrides: Omit<Partial<UptimeStatusCodeOp>, 'op'> = {}
): UptimeStatusCodeOp {
  return {
    id: uniqueId(),
    op: UptimeOpType.STATUS_CODE_CHECK,
    operator: {cmp: UptimeComparisonType.EQUALS},
    value: 200,
    ...overrides,
  };
}

export function makeJsonPathOp(
  overrides: Omit<Partial<UptimeJsonPathOp>, 'op'> = {}
): UptimeJsonPathOp {
  return {
    id: uniqueId(),
    op: UptimeOpType.JSON_PATH,
    value: '$.status',
    operator: {cmp: UptimeComparisonType.EQUALS},
    operand: {jsonpath_op: 'literal', value: 'ok'},
    ...overrides,
  };
}

export function makeHeaderCheckOp(
  overrides: Omit<Partial<UptimeHeaderCheckOp>, 'op'> = {}
): UptimeHeaderCheckOp {
  return {
    id: uniqueId(),
    op: UptimeOpType.HEADER_CHECK,
    key_op: {cmp: UptimeComparisonType.EQUALS},
    key_operand: {header_op: 'literal', value: 'content-type'},
    value_op: {cmp: UptimeComparisonType.EQUALS},
    value_operand: {header_op: 'literal', value: 'application/json'},
    ...overrides,
  };
}
