import {uniqueId} from 'sentry/utils/guid';
import {
  ComparisonType,
  OpType,
  type AndOp,
  type HeaderCheckOp,
  type JsonPathOp,
  type NotOp,
  type OrOp,
  type StatusCodeOp,
} from 'sentry/views/alerts/rules/uptime/types';

export function makeAndOp(overrides: Omit<Partial<AndOp>, 'op'> = {}): AndOp {
  const {children, ...rest} = overrides;
  return {
    id: uniqueId(),
    op: OpType.AND,
    children: children ?? [],
    ...rest,
  };
}

export function makeOrOp(overrides: Omit<Partial<OrOp>, 'op'> = {}): OrOp {
  const {children, ...rest} = overrides;
  return {
    id: uniqueId(),
    op: OpType.OR,
    children: children ?? [],
    ...rest,
  };
}

export function makeNotOp(overrides: Omit<Partial<NotOp>, 'op'> = {}): NotOp {
  const {operand, ...rest} = overrides;
  return {
    id: uniqueId(),
    op: OpType.NOT,
    operand: operand ?? makeAndOp({children: [makeStatusCodeOp()]}),
    ...rest,
  };
}

export function makeStatusCodeOp(
  overrides: Omit<Partial<StatusCodeOp>, 'op'> = {}
): StatusCodeOp {
  return {
    id: uniqueId(),
    op: OpType.STATUS_CODE_CHECK,
    operator: {cmp: ComparisonType.EQUALS},
    value: 200,
    ...overrides,
  };
}

export function makeJsonPathOp(
  overrides: Omit<Partial<JsonPathOp>, 'op'> = {}
): JsonPathOp {
  return {
    id: uniqueId(),
    op: OpType.JSON_PATH,
    value: '$.status',
    operator: {cmp: ComparisonType.EQUALS},
    operand: {jsonpath_op: 'literal', value: 'ok'},
    ...overrides,
  };
}

export function makeHeaderCheckOp(
  overrides: Omit<Partial<HeaderCheckOp>, 'op'> = {}
): HeaderCheckOp {
  return {
    id: uniqueId(),
    op: OpType.HEADER_CHECK,
    key_op: {cmp: ComparisonType.EQUALS},
    key_operand: {header_op: 'literal', value: 'content-type'},
    value_op: {cmp: ComparisonType.EQUALS},
    value_operand: {header_op: 'literal', value: 'application/json'},
    ...overrides,
  };
}
