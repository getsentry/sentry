namespace Profiling {
  interface RawProfileBase {
    endValue: number;
    startValue: number;
    name: string;
    unit: string;
    spans?: RawSpan[];
  }

  // Android traces follow this format
  interface EventedProfile extends RawProfileBase {
    events: ReadonlyArray<{at: number; frame: number; type: 'O' | 'C'}>;
    type: 'evented';
  }

  // iOS traces follow this format
  interface SampledProfile extends RawProfileBase {
    weights: number[];
    samples: number[][];
    type: 'sampled';
  }

  type Span = {
    duration_ms: number;
    name: string;
    queue_label: string;
    relative_start_ms: number;
    thread_id: number;
    children?: Span[];
  };

  type FrameInfo = {
    key: number | string;
    name: string;
    file?: string;
    line?: number;
    column?: number;
    is_application?: boolean;
    image?: string;
    resource?: string;
  };

  type ProfileTypes = EventedProfile | SampledProfile | JSSelfProfiling.Trace;

  type ImportedProfiles = {
    name: string;
    traceID: string;
    activeProfileIndex: number;
    profiles: Profile[];
  };

  // This extends speedscope's schema - we are keeping this as is, but we are likely to diverge as we add more
  // sentry related features to the flamegraphs. This should happen after the MVP integration
  type Schema = {
    name: string;
    activeProfileIndex: number;
    profiles: ReadonlyArray<ProfileTypes>;
    shared: {
      frames: ReadonlyArray<Omit<FrameInfo, 'key'>>;
    };
  };
}
