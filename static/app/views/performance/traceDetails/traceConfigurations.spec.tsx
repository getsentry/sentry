import {ProjectFixture} from 'sentry-fixture/project';

import {getCustomInstrumentationLink} from './traceConfigurations';

describe('getCustomInstrumentationLink', () => {
  it.each(['react-native', 'expo'] as const)(
    'links %s projects to the React Native docs',
    platform => {
      expect(getCustomInstrumentationLink(ProjectFixture({platform}))).toBe(
        'https://docs.sentry.io/platforms/react-native/tracing/instrumentation/custom-instrumentation/'
      );
    }
  );
});
