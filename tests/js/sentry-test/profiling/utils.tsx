import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {EventedProfile} from 'sentry/utils/profiling/profile/eventedProfile';
import {createFrameIndex} from 'sentry/utils/profiling/profile/utils';

export const makeContextMock = (
  partialMock: Partial<WebGLRenderingContext> = {}
): WebGLRenderingContext => {
  const context: Partial<WebGLRenderingContext> = {
    attachShader: vi.fn(),
    bufferData: vi.fn(),
    blendFuncSeparate: vi.fn(),
    bindBuffer: vi.fn(),
    clearColor: vi.fn(),
    clear: vi.fn(),
    createShader: vi.fn().mockReturnValue({}),
    createProgram: vi.fn().mockReturnValue({}),
    createBuffer: vi.fn().mockReturnValue([]),
    compileShader: vi.fn(),
    drawArrays: vi.fn(),
    enable: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    getShaderParameter: vi.fn().mockReturnValue(1),
    getProgramParameter: vi.fn().mockReturnValue({}),
    getUniformLocation: vi.fn().mockReturnValue({}),
    getAttribLocation: vi.fn().mockReturnValue({}),
    linkProgram: vi.fn(),
    shaderSource: vi.fn(),
    uniformMatrix3fv: vi.fn(),
    uniform1i: vi.fn(),
    uniform2f: vi.fn(),
    useProgram: vi.fn(),
    vertexAttribPointer: vi.fn(),
    viewport: vi.fn(),

    canvas: {
      width: 1000,
      height: 1000,
    } as HTMLCanvasElement,
    ...partialMock,
  };

  return context as WebGLRenderingContext;
};

export const makeCanvasMock = (
  partialMock: Partial<HTMLCanvasElement> = {}
): HTMLCanvasElement => {
  const canvas: Partial<HTMLCanvasElement> = {
    getContext: vi.fn().mockReturnValue(makeContextMock()),
    height: 1000,
    width: 1000,
    ...partialMock,
  };

  return canvas as HTMLCanvasElement;
};

const base: Profiling.EventedProfile = {
  name: 'profile',
  startValue: 0,
  endValue: 10,
  unit: 'milliseconds',
  type: 'evented',
  threadID: 0,
  events: [
    {type: 'O', at: 0, frame: 0},
    {type: 'C', at: 10, frame: 0},
  ],
};

export const makeFlamegraph = (
  trace?: Partial<Profiling.EventedProfile>,
  frames?: Profiling.Schema['shared']['frames']
): Flamegraph => {
  return new Flamegraph(
    EventedProfile.FromProfile(
      trace ? {...base, ...trace} : base,
      createFrameIndex('mobile', frames ?? [{name: 'f0'}]),
      {type: 'flamechart'}
    ),
    {inverted: false, sort: 'call order'}
  );
};
