declare namespace Profiling {
  interface RawProfileBase {
    endValue: number;
    startValue: number;
    name: string;
    threadID: number;
    unit: string;
    spans?: Span[];
    threadID: number;
  }

  // Android traces follow this format
  interface EventedProfile extends RawProfileBase {
    events: ReadonlyArray<Event>;
    type: 'evented';
  }

  // iOS traces follow this format
  interface SampledProfile extends RawProfileBase {
    weights: number[];
    samples: number[][];
    type: 'sampled';
  }

  type Event = {at: number; frame: number; type: 'O' | 'C'};

  type Span = {
    duration_ms: number;
    name: string;
    queue_label: string;
    relative_start_ms: number;
    thread_id: number;
    children?: Span[];
  };

  type FrameInfo = {
    key: string | number;
    name: string;
    file?: string;
    line?: number;
    column?: number;
    is_application?: boolean;
    image?: string;
    resource?: string;
    threadId?: number;
  };

  type ProfileTypes = EventedProfile | SampledProfile | JSSelfProfiling.Trace;

  type ImportedProfiles = {
    name: string;
    traceID: string;
    activeProfileIndex: number;
    profiles: ProfileTypes[];
  };

  // This extends speedscope's schema - we are keeping this as is, but we are likely to diverge as we add more
  // sentry related features to the flamegraphs. This should happen after the MVP integration
  type Schema = {
    durationNS: number;
    platform: string;
    profileID: string;
    profiles: ReadonlyArray<ProfileTypes>;
    projectID: number;
    shared: {
      frames: ReadonlyArray<Omit<FrameInfo, 'key'>>;
    };
    transactionName: string;
    version: string;
    activeProfileIndex?: number;
    androidClock?: 'Global' | 'Dual' | 'Wall' | 'Cpu';
  };
}
