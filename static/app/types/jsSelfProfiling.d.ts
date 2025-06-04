// Type definitions for https://wicg.github.io/js-self-profiling/
declare namespace JSSelfProfiling {
  type Marker = 'script' | 'gc' | 'style' | 'layout' | 'paint' | 'other';

  type Sample = {
    timestamp: number;
    stackId: number;
    marker?: Marker;
  };

  type Stack = {
    frameId: number;
    parentId?: number;
  };

  type Frame = {
    name: string;
    resourceId?: number;
    line?: number;
    column?: number;
  };

  type Trace = {
    resources: string[];
    frames: Frame[];
    stacks: Stack[];
    samples: Sample[];
  };

  type BufferFullCallback = (trace: Trace) => void;

  interface Profiler {
    sampleInterval: number;
    stopped: boolean;

    new (options: {sampleInterval: number; maxBufferSize: number}): Profiler;
    addEventListener(event: 'samplebufferfull', callback: BufferFullCallback): void;
    stop: () => Promise<Trace>;
  }
}
