import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {EventedProfile} from 'sentry/utils/profiling/profile/eventedProfile';
import {createFrameIndex} from 'sentry/utils/profiling/profile/utils';

export const makeContextMock = (
  partialMock: Partial<WebGLRenderingContext> = {}
): WebGLRenderingContext => {
  const context: Partial<WebGLRenderingContext> = {
    attachShader: jest.fn(),
    bufferData: jest.fn(),
    blendFuncSeparate: jest.fn(),
    bindBuffer: jest.fn(),
    clearColor: jest.fn(),
    clear: jest.fn(),
    createShader: jest.fn().mockReturnValue({}),
    createProgram: jest.fn().mockReturnValue({}),
    createBuffer: jest.fn().mockReturnValue([]),
    compileShader: jest.fn(),
    drawArrays: jest.fn(),
    enable: jest.fn(),
    enableVertexAttribArray: jest.fn(),
    getShaderParameter: jest.fn().mockReturnValue(1),
    getProgramParameter: jest.fn().mockReturnValue({}),
    getUniformLocation: jest.fn().mockReturnValue({}),
    getAttribLocation: jest.fn().mockReturnValue({}),
    linkProgram: jest.fn(),
    shaderSource: jest.fn(),
    uniformMatrix3fv: jest.fn(),
    uniform1i: jest.fn(),
    uniform2f: jest.fn(),
    useProgram: jest.fn(),
    vertexAttribPointer: jest.fn(),
    viewport: jest.fn(),

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
    getContext: jest.fn().mockReturnValue(makeContextMock()),
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
