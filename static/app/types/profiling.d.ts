namespace Profiling interface RawProfileBase {
  endValue: number;
  startValue: number;
  name: string;
  unit: string;
  spans?: RawSpan[];
  shared: {
    frames: ReadonlyArray<Omit<FrameInfo, 'key'>>;
  };
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

interface Event {
  at: number;;
  frame: number;;
  type: 'O' | 'C';
}

interface Span {
  duration_ms: number;;
  name: string;;
  queue_label: string;;
  relative_start_ms: number;;
  thread_id: number;;
  children?: Span[];;
}

interface FrameInfo {
  key: number | string;;
  name: string;;
  file?: string;;
  line?: number;;
  column?: number;;
  is_application?: boolean;;
  image?: string;;
  resource?: string;;
}

type ProfileTypes = EventedProfile | SampledProfile | JSSelfProfiling.Trace;

interface ImportedProfiles {
  name: string;;
  traceID: string;;
  activeProfileIndex: number;;
  profiles: ProfileTypes[];;
}

interface Schema {
  name: string;;
  activeProfileIndex: number;;
  profiles: ReadonlyArray<ProfileTypes>;;
  shared: {
    frames: ReadonlyArray<Omit<FrameInfo, 'key'>>;
  };;
}
