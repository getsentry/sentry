import {isRecord} from 'sentry/utils/object/isRecord';

export type ToolOutputData =
  | {kind: 'missing'; value: undefined}
  | {kind: 'null'; value: null}
  | {kind: 'array'; value: unknown[]}
  | {kind: 'object'; value: Record<string, unknown>}
  | {kind: 'text'; value: string}
  | {kind: 'number'; value: number}
  | {kind: 'boolean'; value: boolean};

export function parseToolOutput(value: unknown): ToolOutputData {
  let output: unknown = value;
  if (typeof value === 'string') {
    try {
      output = JSON.parse(value);
    } catch {
      output = value;
    }
  }

  if (output === null) {
    return {kind: 'null', value: output};
  }
  if (Array.isArray(output)) {
    return {kind: 'array', value: output};
  }
  if (isRecord(output)) {
    return {kind: 'object', value: output};
  }
  switch (typeof output) {
    case 'string':
      return {kind: 'text', value: output};
    case 'number':
      return {kind: 'number', value: output};
    case 'boolean':
      return {kind: 'boolean', value: output};
    default:
      return {kind: 'missing', value: undefined};
  }
}
