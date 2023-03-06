declare namespace Profiling {
  type Release = import('sentry/types').Release;
  type SentrySampledProfileSample = {
    stack_id: number;
    thread_id: string;
    elapsed_since_start_ns: string;
    queue_address?: string;
  };

  type SentrySampledProfileStack = number[];

  type SentrySampledProfileFrame = {
    function?: string;
    instruction_addr?: string;
    lineno?: number;
    colno?: number;
    filename?: string;
  };

  type SentrySampledProfileDebugMetaImage = {
    debug_id: string;
    image_addr: string;
    code_file: string;
    type: string;
    image_size: number;
    image_vmaddr: string;
  };

  type SentrySampledProfileTransaction = {
    name: string;
    trace_id: string;
    id: string;
    active_thread_id: string;
    relative_start_ns: string;
    relative_end_ns: string;
  };

  type SentrySampledProfile = {
    event_id: string;
    version: string;
    os: {
      name: string;
      version: string;
      build_number: string;
    };
    device: {
      architecture: string;
      is_emulator?: boolean;
      locale?: string;
      manufacturer?: string;
      model?: string;
    };
    runtime?: {
      name: string;
      version: string;
    };
    timestamp: string;
    release: string;
    platform: string;
    environment?: string;
    debug_meta?: {
      images: SentryProfileDebugMetaImage[];
    };
    profile: {
      samples: SentrySampledProfileSample[];
      stacks: SentrySampledProfileStack[];
      frames: SentrySampledProfileFrame[];
      thread_metadata?: Record<string, {name?: string; priority?: number}>;
      queue_metadata?: Record<string, {label: string}>;
    };
    transactions?: SentrySampledProfileTransaction[];
  };

  ////////////////
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
    path?: string;
    line?: number;
    column?: number;
    is_application?: boolean;
    image?: string;
    resource?: string;
    threadId?: number;
    inline?: boolean;

    // nodejs only
    columnNumber?: number;
    lineNumber?: number;
    scriptName?: string;
    scriptId?: number;
  };

  type ProfileInput =
    | Profiling.Schema
    | JSSelfProfiling.Trace
    | ChromeTrace.ProfileType
    | Profiling.SentrySampledProfile;

  type ImportedProfiles = {
    name: string;
    profileID: string;
    activeProfileIndex: number;
    profiles: ReadonlyArray<ProfileInput>;
  };

  type FrameRender = {
    elapsed_since_start_ns: number;
    value: number;
  };

  // This extends speedscope's schema - we are keeping this as is, but we are likely to diverge as we add more
  // sentry related features to the flamegraphs. This should happen after the MVP integration
  type Schema = {
    profileID: string;
    profiles: ReadonlyArray<
      Readonly<EventedProfile | SampledProfile | JSSelfProfiling.Trace>
    >;
    projectID: number;
    shared: {
      frames: ReadonlyArray<Omit<FrameInfo, 'key'>>;
    };
    measurements?: {
      screen_frame_rates?: {
        unit: string;
        values: {elapsed_since_start_ns: number; value: number}[];
      };
      frozen_frame_renders?: {
        unit: string;
        values: FrameRender[];
      };
      slow_frame_renders?: {
        unit: string;
        values: FrameRender[];
      };
    };
    activeProfileIndex?: number;
    metadata: {
      androidAPILevel: number;
      deviceClassification: string;
      deviceLocale: string;
      deviceManufacturer: string;
      deviceModel: string;
      deviceOSName: string;
      deviceOSVersion: string;
      durationNS: number;
      environment: string;
      organizationID: number;
      platform: string;
      profileID: string;
      projectID: number;
      received: string;
      traceID: string;
      transactionID: string;
      release: Release | null;
      transactionName: string;
    };
  };
}
