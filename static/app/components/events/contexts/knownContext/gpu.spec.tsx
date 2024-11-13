import {EventFixture} from 'sentry-fixture/event';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ContextCard from 'sentry/components/events/contexts/contextCard';
import {
  getGPUContextData,
  type GPUContext,
} from 'sentry/components/events/contexts/knownContext/gpu';

export const MOCK_GPU_CONTEXT: GPUContext = {
  name: '',
  version: 'Metal',
  id: 2400,
  vendor_id: '2400.0.0',
  vendor_name: 'Apple',
  memory_size: 4096,
  api_type: '',
  multi_threaded_rendering: true,
  npot_support: 'Full',
  max_texture_size: 16384,
  graphics_shader_level: 'OpenGL ES 3.0',
  supports_draw_call_instancing: true,
  supports_ray_tracing: true,
  supports_compute_shaders: true,
  supports_geometry_shaders: true,
  // Extra data is still valid and preserved
  extra_data: 'something',
  unknown_key: 123,
};

const MOCK_REDACTION = {
  api_type: {
    '': {
      rem: [['organization:0', 's', 0, 0]],
      len: 5,
    },
  },
};

describe('GPUContext', function () {
  it('returns values and according to the parameters', function () {
    expect(getGPUContextData({data: MOCK_GPU_CONTEXT})).toEqual([
      {key: 'name', subject: 'Name', value: ''},
      {key: 'version', subject: 'Version', value: 'Metal'},
      {key: 'id', subject: 'GPU ID', value: 2400},
      {key: 'vendor_id', subject: 'Vendor ID', value: '2400.0.0'},
      {key: 'vendor_name', subject: 'Vendor Name', value: 'Apple'},
      {key: 'memory_size', subject: 'Memory', value: '4.0 GiB'},
      {key: 'api_type', subject: 'API Type', value: ''},
      {key: 'multi_threaded_rendering', subject: 'Multi-Thread Rendering', value: true},
      {key: 'npot_support', subject: 'NPOT Support', value: 'Full'},
      {key: 'max_texture_size', subject: 'Max Texture Size', value: 16384},
      {
        key: 'graphics_shader_level',
        subject: 'Approx. Shader Capability',
        value: 'OpenGL ES 3.0',
      },
      {
        key: 'supports_draw_call_instancing',
        subject: 'Supports Draw Call Instancing',
        value: true,
      },
      {key: 'supports_ray_tracing', subject: 'Supports Ray Tracing', value: true},
      {key: 'supports_compute_shaders', subject: 'Supports Compute Shaders', value: true},
      {
        key: 'supports_geometry_shaders',
        subject: 'Supports Geometry Shaders',
        value: true,
      },
      {
        key: 'extra_data',
        subject: 'extra_data',
        value: 'something',
      },
      {
        key: 'unknown_key',
        subject: 'unknown_key',
        value: 123,
      },
    ]);
  });

  it('renders with meta annotations correctly', function () {
    const event = EventFixture({
      _meta: {contexts: {gpu: MOCK_REDACTION}},
    });

    render(
      <ContextCard
        event={event}
        type={'gpu'}
        alias={'gpu'}
        value={{...MOCK_GPU_CONTEXT, api_type: ''}}
      />
    );

    expect(screen.getByText('Graphics Processing Unit')).toBeInTheDocument();
    expect(screen.getByText('Memory')).toBeInTheDocument();
    expect(screen.getByText('4.0 GiB')).toBeInTheDocument();
    expect(screen.getByText('API Type')).toBeInTheDocument();
    expect(screen.getByText(/redacted/)).toBeInTheDocument();
  });
});
