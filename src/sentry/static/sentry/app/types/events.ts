import {StacktraceType, RawStacktrace} from './stacktrace';

export interface Thread {
  id: number;
  crashed: boolean;
  current: boolean;
  rawStacktrace: RawStacktrace;
  stacktrace: StacktraceType;
  name?: string;
}
