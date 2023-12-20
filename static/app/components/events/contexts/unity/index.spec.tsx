import {Event as EventFixture} from 'sentry-fixture/event';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {UnityEventContext} from 'sentry/components/events/contexts/unity';
import {UnityContext} from 'sentry/types';

export const unityMockData: UnityContext = {
  copy_texture_support: 'Basic, Copy3D, DifferentTypes, TextureToRT, RTToTexture',
  editor_version: '2022.1.23f1',
  install_mode: 'Store',
  rendering_threading_mode: 'LegacyJobified',
  target_frame_rate: '-1',
  type: 'unity',
};

export const unityMetaMockData = {
  '': {
    rem: [['organization:0', 'x']],
  },
};

const event = EventFixture({
  _meta: {
    contexts: {
      unity: unityMetaMockData,
    },
  },
});

describe('unity event context', function () {
  it('display redacted data', function () {
    render(<UnityEventContext event={event} data={null} />);
    expect(screen.queryByText('Unity')).not.toBeInTheDocument();
  });
});
