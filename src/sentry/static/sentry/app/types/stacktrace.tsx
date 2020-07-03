import {Frame} from 'app/components/events/interfaces/frame/types';

export type StackViewType = 'app' | 'full' | 'raw';

export type Stacktrace = {
  frames: Array<Frame>;
  hasSystemFrames: boolean;
  registers: {[key: string]: string} | null;
  framesOmitted: any;
};

export type RawStacktrace = null | Stacktrace;
