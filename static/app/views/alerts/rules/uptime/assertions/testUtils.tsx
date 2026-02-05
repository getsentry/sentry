import {uniqueId} from 'sentry/utils/guid';
import type {
  AndOp,
  HeaderCheckOp,
  JsonPathOp,
  NotOp,
  OrOp,
  StatusCodeOp,
} from 'sentry/views/alerts/rules/uptime/types';

export function makeAndOp(overrides: Omit<Partial<AndOp>, 'op'> = {}): AndOp {
  const {children, ...rest} = overrides;
  return {
    id: uniqueId(),
    op: 'and',
    children: children ?? [],
    ...rest,
  };
}

export function makeOrOp(overrides: Omit<Partial<OrOp>, 'op'> = {}): OrOp {
  const {children, ...rest} = overrides;
  return {
    id: uniqueId(),
    op: 'or',
    children: children ?? [],
    ...rest,
  };
}

export function makeNotOp(overrides: Omit<Partial<NotOp>, 'op'> = {}): NotOp {
  const {operand, ...rest} = overrides;
  return {
    id: uniqueId(),
    op: 'not',
    operand: operand ?? makeAndOp({children: [makeStatusCodeOp()]}),
    ...rest,
  };
}

export function makeStatusCodeOp(
  overrides: Omit<Partial<StatusCodeOp>, 'op'> = {}
): StatusCodeOp {
  return {
    id: uniqueId(),
    op: 'status_code_check',
    operator: {cmp: 'equals'},
    value: 200,
    ...overrides,
  };
}

export function makeJsonPathOp(
  overrides: Omit<Partial<JsonPathOp>, 'op'> = {}
): JsonPathOp {
  return {
    id: uniqueId(),
    op: 'json_path',
    value: '$.status',
    operator: {cmp: 'equals'},
    operand: {jsonpath_op: 'literal', value: 'ok'},
    ...overrides,
  };
}

export function makeHeaderCheckOp(
  overrides: Omit<Partial<HeaderCheckOp>, 'op'> = {}
): HeaderCheckOp {
  return {
    id: uniqueId(),
    op: 'header_check',
    key_op: {cmp: 'equals'},
    key_operand: {header_op: 'literal', value: 'content-type'},
    value_op: {cmp: 'equals'},
    value_operand: {header_op: 'literal', value: 'application/json'},
    ...overrides,
  };
}
