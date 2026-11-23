import {FrameFixture} from 'sentry-fixture/frame';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DefaultTitle} from './defaultTitle';

describe('DefaultTitle', () => {
  it('renders the package when the frame has one', () => {
    render(
      <DefaultTitle frame={FrameFixture({package: 'MyApp.app/MyApp'})} platform="cocoa" />
    );

    expect(screen.getByText('MyApp')).toBeInTheDocument();
  });

  it('falls back to the debug image name when the frame has no package', () => {
    render(
      <DefaultTitle
        frame={FrameFixture({package: null})}
        platform="cocoa"
        fallbackPackageName="MyApp.app/MyApp"
      />
    );

    expect(screen.getByText('MyApp')).toBeInTheDocument();
  });

  it('does not render a package without one', () => {
    render(
      <DefaultTitle
        frame={FrameFixture({package: null, function: null, rawFunction: null})}
        platform="cocoa"
      />
    );

    expect(screen.queryByText('MyApp')).not.toBeInTheDocument();
  });
});
