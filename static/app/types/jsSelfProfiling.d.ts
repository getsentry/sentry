// Type definitions for https://wicg.github.io/js-self-profiling/
namespace JSSelfProfiling {
  type Marker = 'script' | 'gc' | 'style' | 'layout' | 'paint' | 'other';

  interface Sample {
    timestamp: number;
    stackId?: number;
    marker?: Marker;
  }

  interface Stack {
    parentId?: number;
    frameId: number;
  }

  interface Frame {
    name: string;
    resourceId: number;
    line: number;
    column: number;
  }

  type Resource = string;

  interface Trace {
    resources: Resource[];
    frames: Frame[];
    stacks: Stack[];
    samples: Sample[];
  }

  type BufferFullCallback = (trace: Trace) => void;

  interface Profiler {
    sampleInterval: number;
    stopped: boolean;

    new (options: {sampleInterval: number; maxBufferSize: number}): Profiler;
    addEventListener(event: 'samplebufferfull', callback: BufferFullCallback): void;
    stop: () => Promise<ProfilerTrace>;
  }
}
