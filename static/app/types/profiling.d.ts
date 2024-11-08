declare namespace Profiling {
  type Release = import('sentry/types').Release;

  type Image = import('sentry/types/debugImage').Image;

  type SymbolicatorStatus =
    import('sentry/components/events/interfaces/types').SymbolicatorStatus;

  type MeasurementValue = {
    elapsed_since_start_ns: number;
    value: number;
  };

  type ContinuousMeasurementValue = {
    timestamp: number;
    value: number;
  };

  type Measurement = {
    unit: string;
    values: MeasurementValue[];
  };

  type ContinuousMeasurement = {
    unit: string;
    values: ContinuousMeasurementValue[];
  };

  type Measurements = {
    cpu_usage?: Measurement;
    memory_footprint?: Measurement;
    frozen_frame_renders?: Measurement;
    screen_frame_rates?: Measurement;
    slow_frame_renders?: Measurement;
    [key: string]: Measurement;
  };

  type ContinuousMeasurements = {
    cpu_usage?: ContinuousMeasurement;
    memory_footprint?: ContinuousMeasurement;
    frozen_frame_renders?: ContinuousMeasurement;
    screen_frame_rates?: ContinuousMeasurement;
    slow_frame_renders?: ContinuousMeasurement;
    [key: string]: ContinuousMeasurement;
  };

  type SentrySampledProfileSample = {
    stack_id: number;
    thread_id: string;
    elapsed_since_start_ns: number;
    queue_address?: string;
  };

  type SentrySampledProfileChunkSample = {
    stack_id: number;
    thread_id: string;
    timestamp: number;
  };

  type SentrySampledProfileFrame = {
    in_app: boolean;
    // These differ slightly from the speedscope schema, but just
    // override them right now as we don't use the speedscope schema anymore
    abs_path?: string;
    col?: number;
    colno?: number;
    column?: number;
    filename?: string;
    function?: string;
    instruction_addr?: string;
    lineno?: number;
    module?: string;
    package?: string;
    platform?: string;
    status?: SymbolicatorStatus;
    sym_addr?: string;
    symbol?: string;
  };

  type SentrySampledProfileTransaction = {
    name: string;
    trace_id: string;
    id: string;
    active_thread_id: number;
  };

  type SentrySampledProfile = {
    event_id: string;
    project_id: number;
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
    received: string;
    timestamp: string;
    release: Release | null;
    platform: 'node' | 'javascript' | string;
    environment?: string;
    debug_meta?: {
      images: Image[];
    };
    profile: {
      samples: SentrySampledProfileSample[];
      stacks: SentrySampledProfileStack[];
      frames: SentrySampledProfileFrame[];
      thread_metadata?: Record<string, {name?: string; priority?: number}>;
      queue_metadata?: Record<string, {label: string}>;
    };
    transaction: SentrySampledProfileTransaction;
    measurements?: Measurements;
  };

  interface SentryContinousProfileChunk {
    chunk_id: string;
    environment: string;
    project_id: number;
    received: number;
    release: string;
    organization_id: number;
    retention_days: number;
    project_id: string;
    version: '2';
    debug_meta?: {
      images: Image[];
    };
    platform: string;
    measurements?: ContinuousMeasurements;
    profile: ContinuousProfile;
  }

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
    samples_profiles?: number[][];
    samples_examples?: number[][];
    sample_durations_ns?: number[];
    type: 'sampled';
  }

  type ContinuousProfile = {
    samples: SentrySampledProfileChunkSample[];
    frames: SentrySampledProfileFrame[];
    stacks: SentrySampledProfileStack[];
    thread_metadata?: Record<string, {name?: string; priority?: number}>;
  };

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
    col?: number;
    colno?: number;
    column?: number;
    file?: string;
    image?: string;
    inline?: boolean;
    instructionAddr?: string;
    is_application?: boolean;
    key: string | number;
    line?: number;
    // This is the import path for the module
    module?: string;
    name: string;
    // This is used for native platforms to indicate the name of the assembly, path of the dylib, etc
    package?: string;
    path?: string;
    platform?: string;
    resource?: string;
    symbol?: string;
    symbolAddr?: string;
    symbolicatorStatus?: SymbolicatorStatus;
    threadId?: number;

    // nodejs only
    columnNumber?: number;
    lineNumber?: number;
    scriptName?: string;
    scriptId?: number;
  };

  type FunctionMetric = {
    avg: number;
    count: number;
    examples: Exclude<ProfileReference, string>[];
    fingerprint: number;
    in_app: boolean;
    name: string;
    p75: number;
    p95: number;
    p99: number;
    package: string;
    sum: number;
  };

  type ProfileInput =
    | Profiling.Schema
    | JSSelfProfiling.Trace
    | Profiling.SentrySampledProfile
    | Profiling.SentryContinousProfileChunk;

  type ImportedProfiles = {
    name: string;
    profileID: string;
    activeProfileIndex: number;
    profiles: ReadonlyArray<ProfileInput>;
  };

  type BaseTransactionProfileReference = {
    profile_id: string;
  };

  type BaseContinuousProfileReference = {
    end: number;
    profiler_id: string;
    start: number;
    thread_id: string;
  };

  type BaseProfileReference =
    | BaseTransactionProfileReference
    | BaseContinuousProfileReference;

  type TransactionProfileReference = BaseTransactionProfileReference & {
    project_id: number;
  };

  type ContinuousProfileReference = BaseContinuousProfileReference & {
    project_id: number;
    transaction_id: string | undefined;
    chunk_id: string;
  };

  type ProfileReference =
    | TransactionProfileReference
    | ContinuousProfileReference
    | string;

  // We have extended the speedscope schema to include some additional metadata and measurements
  interface Schema {
    metadata: {
      androidAPILevel: number;
      deviceClassification: string;
      deviceLocale: string;
      deviceManufacturer: string;
      deviceModel: string;
      deviceOSName: string;
      deviceOSVersion: string;
      environment: string;
      organizationID: number;
      platform: string;
      profileID: string;
      projectID: number;
      received: string;
      release: Release | null;
      traceID: string;
      transactionID: string;
      transactionName: string;
      timestamp?: string;
    };
    profileID: string;
    projectID: number;
    measurements?: Measurements;
    profiles: ReadonlyArray<
      Readonly<
        Profiling.EventedProfile | Profiling.SampledProfile | JSSelfProfiling.Trace
      >
    >;
    shared: {
      frames: ReadonlyArray<Omit<Profiling.FrameInfo, 'key'>>;
      profile_ids?: ReadonlyArray<string>[];
      profiles?: ReadonlyArray<ProfileReference>;
    };
    activeProfileIndex?: number;
    metrics?: FunctionMetric[];
  }
}
