import type {Frame} from './event';

export enum StackView {
  RAW = 'raw',
  FULL = 'full',
  APP = 'app',
}

export enum StackType {
  ORIGINAL = 'original',
  MINIFIED = 'minified',
}

export type StacktraceType = {
  framesOmitted: any;
  hasSystemFrames: boolean;
  registers: Record<string, any> | null;
  frames?: Frame[];
};

export type RawStacktrace = StacktraceType | null;

type MechanismMeta = {
  errno?: {
    number: number;
    name?: string;
  };
  mach_exception?: {
    code: number;
    exception: number;
    subcode: number;
    name?: string;
  };
  signal?: {
    number: number;
    code?: number;
    code_name?: string;
    name?: string;
  };
};

export type StackTraceMechanism = {
  handled: boolean;
  type: string;
  data?: object;
  description?: string;
  exception_id?: number;
  help_link?: string;
  is_exception_group?: boolean;
  meta?: MechanismMeta;
  parent_id?: number;
  source?: string;
  synthetic?: boolean;
};
