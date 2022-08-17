import type {Frame} from './event';

export enum STACK_VIEW {
  RAW = 'raw',
  FULL = 'full',
  APP = 'app',
}

export enum STACK_TYPE {
  ORIGINAL = 'original',
  MINIFIED = 'minified',
}

export type StacktraceType = {
  framesOmitted: any;
  hasSystemFrames: boolean;
  registers: Record<string, any> | null;
  frames?: Array<Frame>;
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
  help_link?: string;
  meta?: MechanismMeta;
  synthetic?: boolean;
};
