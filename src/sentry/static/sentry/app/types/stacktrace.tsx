import {Frame} from 'app/types';

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
  frames: Array<Frame>;
  hasSystemFrames: boolean;
  registers: Record<string, any> | null;
  framesOmitted: any;
};

export type RawStacktrace = StacktraceType | null;

type MechanismMeta = {
  errno?: {
    number: number;
    name?: string;
  };
  mach_exception?: {
    exception: number;
    code: number;
    subcode: number;
    name?: string;
  };
  signal?: {
    number: number;
    code?: number;
    name?: string;
    code_name?: string;
  };
};

export type Mechanism = {
  handled: boolean;
  synthetic: boolean;
  type: string;
  meta?: MechanismMeta;
  data?: object;
  description?: string;
  help_link?: string;
};
