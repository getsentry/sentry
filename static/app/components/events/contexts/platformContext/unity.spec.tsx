import {EventFixture} from 'sentry-fixture/event';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ContextCard from 'sentry/components/events/contexts/contextCard';
import {getUnityContextData} from 'sentry/components/events/contexts/platformContext/unity';

const MOCK_UNITY_CONTEXT = {
  type: 'unity' as const,
  copy_texture_support: 'Basic, Copy3D, DifferentTypes, TextureToRT, RTToTexture',
  editor_version: '2022.1.23f1',
  install_mode: 'Store',
  rendering_threading_mode: 'LegacyJobified',
  target_frame_rate: '-1',
  // Extra data is still valid and preserved
  extra_data: 'something',
  unknown_key: 123,
};

const MOCK_REDACTION = {
  install_mode: {
    '': {
      rem: [['organization:0', 'x']],
    },
  },
};

describe('UnityContext', function () {
  it('returns values and according to the parameters', function () {
    expect(getUnityContextData({data: MOCK_UNITY_CONTEXT})).toEqual([
      {
        key: 'copy_texture_support',
        subject: 'Copy Texture Support',
        value: 'Basic, Copy3D, DifferentTypes, TextureToRT, RTToTexture',
      },
      {
        key: 'editor_version',
        subject: 'Editor Version',
        value: '2022.1.23f1',
      },
      {key: 'install_mode', subject: 'Install Mode', value: 'Store'},
      {
        key: 'rendering_threading_mode',
        subject: 'Rendering Threading Mode',
        value: 'LegacyJobified',
      },
      {
        key: 'target_frame_rate',
        subject: 'Target Frame Rate',
        value: '-1',
      },
      {key: 'extra_data', subject: 'extra_data', value: 'something'},
      {key: 'unknown_key', subject: 'unknown_key', value: 123},
    ]);
  });

  it('renders with meta annotations correctly', function () {
    const event = EventFixture({
      _meta: {contexts: {unity: MOCK_REDACTION}},
    });

    render(
      <ContextCard
        event={event}
        type={'unity'}
        alias={'unity'}
        value={{...MOCK_UNITY_CONTEXT, install_mode: ''}}
      />
    );

    expect(screen.getByText('Unity')).toBeInTheDocument();
    expect(screen.getByText('Editor Version')).toBeInTheDocument();
    expect(screen.getByText('2022.1.23f1')).toBeInTheDocument();
    expect(screen.getByText('Install Mode')).toBeInTheDocument();
    expect(screen.getByText(/redacted/)).toBeInTheDocument();
  });
});
