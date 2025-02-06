import merge from 'lodash/merge';

import type {DeepPartial} from 'sentry/types/utils';
import {CallTreeNode} from 'sentry/utils/profiling/callTreeNode';
import {Frame} from 'sentry/utils/profiling/frame';

export const f = (name: string, key: number, in_app: boolean = true) =>
  new Frame({name, key, is_application: in_app});
export const c = (fr: Frame) => new CallTreeNode(fr, null);
export const firstCallee = (node: CallTreeNode) => node.children[0];
export const nthCallee = (node: CallTreeNode, n: number) => {
  const child = node.children[n];
  if (!child) {
    throw new Error('Child not found');
  }
  return child;
};

export const makeTestingBoilerplate = () => {
  const timings: Array<[Frame['name'], string]> = [];

  const openSpy = jest.fn();
  const closeSpy = jest.fn();

  // We need to wrap the spy fn because they are not allowed to reference external variables
  const open = (node: CallTreeNode, value: number) => {
    timings.push([node.frame.name, 'open']);
    openSpy(node, value);
  };
  // We need to wrap the spy fn because they are not allowed to reference external variables
  const close = (node: CallTreeNode, val: number) => {
    timings.push([node.frame.name, 'close']);
    closeSpy(node, val);
  };

  return {open, close, timings, openSpy, closeSpy};
};

export function makeSentryContinuousProfile(
  profile?: DeepPartial<Profiling.SentryContinousProfileChunk>
): Profiling.SentryContinousProfileChunk {
  return merge(
    {
      chunk_id: 'chunk_id',
      environment: '',
      project_id: 0,
      received: 0,
      release: '',
      organization_id: 0,
      retention_days: 0,
      version: '2',
      platform: 'node',
      profile: {
        samples: [
          {timestamp: Date.now() / 1e3, stack_id: 0, thread_id: '0'},
          // 10ms later
          {timestamp: Date.now() / 1e3 + 0.01, stack_id: 1, thread_id: '0'},
        ],
        frames: [
          {function: 'foo', in_app: true},
          {function: 'bar', in_app: true},
        ],
        stacks: [
          [0, 1],
          [0, 1],
        ],
      },
    },
    profile
  ) as Profiling.SentryContinousProfileChunk;
}

export const makeSentrySampledProfile = (
  profile?: DeepPartial<Profiling.SentrySampledProfile>
) => {
  return merge(
    {
      event_id: '1',
      version: '1',
      os: {
        name: 'iOS',
        version: '16.0',
        build_number: '19H253',
      },
      device: {
        architecture: 'arm64e',
        is_emulator: false,
        locale: 'en_US',
        manufacturer: 'Apple',
        model: 'iPhone14,3',
      },
      timestamp: '2022-09-01T09:45:00.000Z',
      platform: 'cocoa',
      profile: {
        samples: [
          {
            stack_id: 0,
            thread_id: '0',
            elapsed_since_start_ns: 0,
          },
          {
            stack_id: 1,
            thread_id: '0',
            elapsed_since_start_ns: 1000,
          },
        ],
        frames: [
          {
            function: 'main',
            instruction_addr: '',
            lineno: 1,
            colno: 1,
            file: 'main.c',
          },
          {
            function: 'foo',
            instruction_addr: '',
            lineno: 2,
            colno: 2,
            file: 'main.c',
          },
        ],
        stacks: [[1, 0], [0]],
      },
      transaction: {
        id: '',
        name: 'foo',
        active_thread_id: 0,
        trace_id: '1',
      },
    },
    profile
  ) as Profiling.SentrySampledProfile;
};
