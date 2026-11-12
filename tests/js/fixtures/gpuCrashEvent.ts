import {EventFixture} from 'sentry-fixture/event';
import {ExceptionValueFixture} from 'sentry-fixture/exceptionValue';
import {FrameFixture} from 'sentry-fixture/frame';

import {EntryType, type Event} from 'sentry/types/event';

function gpuCrashEvent(
  shader: string,
  pc: string,
  contexts: Record<string, Record<string, unknown>>,
  crumbs: Array<Record<string, unknown>>
): Event {
  return EventFixture({
    contexts: contexts as Event['contexts'],
    entries: [
      {
        type: EntryType.EXCEPTION,
        data: {
          excOmitted: null,
          hasSystemFrames: false,
          values: [
            ExceptionValueFixture({
              mechanism: {type: 'gpu_crash', handled: false},
              stacktrace: {
                frames: [
                  FrameFixture({
                    function: shader,
                    filename: null,
                    instructionAddr: pc,
                    package: `shader_${String(contexts.gpu_crash?.shader_hash)}`,
                  }),
                ],
                framesOmitted: null,
                hasSystemFrames: false,
                registers: null,
              },
            }),
          ],
        },
      },
      {type: EntryType.BREADCRUMBS, data: {values: crumbs}},
    ],
  });
}

export function GpuHangEventFixture(crash: Record<string, unknown> = {}): Event {
  return gpuCrashEvent(
    'vertex_01',
    '0x00000330',
    {
      gpu_crash: {
        type: 'gpu_crash',
        fault_category: 'shader_hang',
        fault_type: 'Timeout',
        fault_description: 'No page fault info reported by the decoder.',
        last_gpu_operation: 'Draw Triangle',
        device_status: 'Timeout',
        device_state: 'Hung',
        engine_reset: true,
        adapter_reset: false,
        active_warps: 1,
        faulting_pc: '0x00000330',
        shader_hash: '59339c1ea8934740',
        shader_type: 'Vertex',
        shader_size: 1536,
        shader_debug_info_uid: '00000210749de540',
        status: 'completed',
        handler: 'aftermath',
        sdk_version: 'aftermath@0x21a',
        decode_time_ms: 1049,
        missing_dif_count: 0,
        ...crash,
      },
      gpu: {
        name: 'TU104-A',
        driver_version: '435.73',
        api_type: 'D3D12',
        generation: 'Turing',
      },
      os: {type: 'os', raw_description: 'Windows 10 (19H1)'},
      app: {type: 'app', app_name: 'd3d12hellonsightaftermath.exe'},
    },
    [
      {
        category: 'gpu.marker',
        message: 'Draw Triangle',
        data: {Pipe: 'Bottom', Status: 'Executing', Type: 'User'},
      },
      {
        category: 'gpu.marker.callstack',
        message: 'GPU marker callstack (6 frames)',
        data: {
          frames: [
            'nvwgf2umx.dll @ 0x7ffec8cd4cd1',
            'nvwgf2umx.dll @ 0x7ffec8e3ff1b',
            'D3D12HelloNsightAftermath.exe @ 0x7ff63915997a',
            'D3D12HelloNsightAftermath.exe @ 0x7ff63915957d',
            'USER32.dll @ 0x7fff378f681d',
            'ntdll.dll @ 0x7fff382ece71',
          ],
        },
      },
      {
        category: 'gpu.application',
        message: 'ApplicationName: D3D12HelloNsightAftermath',
      },
      {category: 'gpu.application', message: 'ApplicationVersion: v1.0'},
      {category: 'gpu.user_defined', message: 'UserDefined+1: Engine State: Rendering.'},
    ]
  );
}

export function GpuPageFaultEventFixture(crash: Record<string, unknown> = {}): Event {
  return gpuCrashEvent(
    'compute_01',
    '0x00001ab0',
    {
      gpu_crash: {
        type: 'gpu_crash',
        fault_category: 'page_fault',
        fault_type: 'PageFault',
        fault_code: 'AddressTranslationError',
        fault_description:
          'GPU page fault at 0x0000021443ea0000 (AddressTranslationError, read, Graphics/GraphicsProcessingCluster)',
        virtual_address: '0x0000021443ea0000',
        access_type: 'read',
        engine: 'Graphics',
        client: 'GraphicsProcessingCluster',
        device_status: 'PageFault',
        device_state: 'Error_DMA_PageFault',
        engine_reset: true,
        adapter_reset: false,
        active_warps: 1,
        faulting_pc: '0x00001ab0',
        fault_name: 'MMU Fault Error',
        fault_detail:
          'A shader instruction caused an MMU fault when accessing memory.\nThis can be caused by shader bugs and binding setup issues.',
        shader_hash: '85374d82655da574',
        shader_type: 'Compute',
        shader_size: 36096,
        shader_debug_info_uid: '87ac7122c61385e5',
        status: 'completed',
        handler: 'aftermath',
        sdk_version: 'aftermath@0x21a',
        decode_time_ms: 3207,
        missing_dif_count: 0,
        faulted_warps: [
          {
            fault_name: 'MMU Fault Error',
            fault_detail:
              'A shader instruction caused an MMU fault when accessing memory.\nThis can be caused by shader bugs and binding setup issues.',
            pc: 'compute_01 @ 0x000018c0',
          },
        ],
        ...crash,
      },
      unreal: {
        type: 'default',
        crash_type: 'GPUCrash',
        error_message: 'Aftermath crash dump',
        engine_version: '5.5.4-0000000+Sample-Win64-0000000',
        build_version: 'Sample-Win64-0000000-CL-0000000',
        build_config: 'Shipping',
        game: 'SampleGame',
        platform: 'Windows',
        engine_mode: 'Game',
        gpu_brand: 'NVIDIA GeForce RTX 4070 Ti SUPER',
        cpu_brand: 'Intel(R) Core(TM) i7-14700K',
        os: 'Windows 11 (26H2) [10.0.26300.9457]',
        total_ram_gb: 48,
        seconds_since_start: 59,
        is_ensure: false,
        is_stall: false,
        is_assert: false,
      },
      gpu: {
        name: 'AD102-A',
        driver_version: '617.14',
        api_type: 'D3D12',
        generation: 'Ada',
        brand: 'NVIDIA GeForce RTX 4070 Ti SUPER',
      },
      os: {type: 'os', raw_description: 'Windows 11 (24H2)'},
      app: {type: 'app', app_name: 'samplegame.exe'},
    },
    [
      {category: 'gpu.application', message: 'ApplicationName: SampleGame'},
      {
        category: 'gpu.application',
        message: 'ApplicationVersion: Sample-Win64-0000000-CL-0000000',
      },
    ]
  );
}
