// https://docs.google.com/document/d/1CvAClvFfyA5R-PhYUmn5OOQtYMH4h6I0nSsKchNAySU/preview

declare namespace ChromeTrace {
  interface ObjectFormat {
    traceEvents: ReadonlyArray<Event>;
    displayTimeUnit: 'ms' | 'ns';
    /**
     *  Linux ftrace data or Windows ETW trace data.
     *  This data must start with # tracer: and adhere to the
     *   Linux ftrace format or adhere to Windows ETW format.
     */
    systemTraceEvents: string;
    otherData: Record<string, string>;
    powerTraceAsString: string;
    /**
     * string that specifies which trace data comes from tracing controller.
     * Its value should be the key for that specific trace data. For example,
     * {..., "controllerTraceDataKey": "traceEvents"} means the data for traceEvents
     * comes from the tracing controller. This is mainly for the purpose of clock synchronization.
     */
    controllerTraceDataKey?: string;
    stackFrames: ReadonlyArray<any>;
    samples: ReadonlyArray<any>;
  }

  type ArrayFormat = Array<Event | ProfileEvent>;
  type DurationEvent = 'B' | 'E';
  // Instant event
  type CompleteEvent = 'X';
  type InstantEvent = 'i';
  type DeprecatedInstantEvent = 'I';

  type CounterEvent = 'C';
  // b = nestable start, n = nestable instant, e = nestable end
  type AsyncEvent = 'b' | 'n' | 'e';
  // S = start, T = step into, p = step past, F = end
  type DeprecatedAsyncEvent = 'S' | 'T' | 'p' | 'F';
  // s = start, t = step, f = end
  type FlowEvent = 's' | 't' | 'f';
  type SampleEvent = 'P';
  // N = created, O = snapshot, D = destroyed
  type ObjectEvent = 'N' | 'O' | 'D';
  type MetadataEvent = 'M';
  // V = global, v = process
  type MemoryDumpEvent = 'V' | 'v';
  type MarkEvent = 'R';
  type ClockSyncEvent = 'c';
  type ContextEvents = '(,)';

  interface Event {
    name: string;
    cat: string;
    ph:
      | DurationEvent
      | CompleteEvent
      | InstantEvent
      | DeprecatedInstantEvent
      | CounterEvent
      | AsyncEvent
      | DeprecatedAsyncEvent
      | FlowEvent
      | SampleEvent
      | ObjectEvent
      | MetadataEvent
      | MemoryDumpEvent
      | MarkEvent
      | ClockSyncEvent
      | ContextEvents;
    ts: number;
    // Thread clock timestamp
    tts?: number;
    dur?: number;
    tdur?: number;
    pid: number;
    tid: number;
    id?: string;
    cname?: string;
    args: Record<string, any | Record<string, any>>;
  }

  // Thread metadata event
  interface ThreadMetadataEvent extends Event {
    cat: '__metadata';
    name: 'thread_name';
    ph: 'M';
    args: {name: string};
  }

  interface ProfileEvent extends Event {
    cat: string;
    id: string;
    name: 'Profile';
    ph: 'P';
    pid: number;
    tid: number;
    ts: number;
    tts: number;
    args: {
      data: {
        cpuProfile: CpuProfile;
        startTime?: number;
        endTime?: number;
        timeDeltas?: number[];
      };
    };
  }

  interface ProfileChunkEvent extends Event {
    cat: string;
    id: string;
    name: 'ProfileChunk';
    ph: 'P';
    pid: number;
    tid: number;
    ts: number;
    tts: number;
    args: {
      data: {
        cpuProfile: CpuProfile;
        startTime?: number;
        endTime?: number;
        timeDeltas?: number[];
      };
    };
  }

  // https://github.com/v8/v8/blob/b8626ca445554b8376b5a01f651b70cb8c01b7dd/src/inspector/js_protocol.json#L1496
  interface PositionTickInfo {
    line: number;
    ticks: number;
  }

  // https://github.com/v8/v8/blob/b8626ca445554b8376b5a01f651b70cb8c01b7dd/src/inspector/js_protocol.json#L2292
  interface CallFrame {
    functionName: string;
    scriptId: string;
    url: string;
    lineNumber: number;
    columnNumber: number;
    // This seems to be present in some profiles with value "JS"
    codeType?: string;
  }

  // https://github.com/v8/v8/blob/b8626ca445554b8376b5a01f651b70cb8c01b7dd/src/inspector/js_protocol.json#L1399
  interface ProfileNode {
    id: number;
    callFrame: CallFrame;
    hitCount: number;
    children?: number[];
    parent?: CPUProfileNode;
    deoptReason?: string;
    positionTicks?: PositionTickInfo[];
  }

  // https://github.com/v8/v8/blob/b8626ca445554b8376b5a01f651b70cb8c01b7dd/src/inspector/js_protocol.json#L1453
  interface CpuProfile {
    nodes: ProfileNode[];
    startTime: number;
    endTime: number;
    samples?: number[];
    timeDeltas?: number[];
  }

  type ProfileType = ArrayFormat | ObjectFormat;
}
