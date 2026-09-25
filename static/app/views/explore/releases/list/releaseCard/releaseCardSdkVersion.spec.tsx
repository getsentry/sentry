import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ReleaseCardSdkVersion} from './releaseCardSdkVersion';

describe('ReleaseCardSdkVersion', () => {
  it('renders the most common SDK version when there is one SDK', () => {
    render(
      <ReleaseCardSdkVersion
        sdkVersions={[{count: 10, name: 'sentry.javascript.react', version: '9.12.0'}]}
      />
    );

    expect(screen.getByText('SDK 9.12.0 · sentry.javascript.react')).toBeInTheDocument();
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
  });

  it('renders a count of other SDK versions when there are several', () => {
    render(
      <ReleaseCardSdkVersion
        sdkVersions={[
          {count: 10, name: 'sentry.javascript.react-native', version: '6.0.0'},
          {count: 5, name: 'sentry.cocoa', version: '8.40.0'},
          {count: 1, name: 'sentry.java.android', version: '8.1.0'},
        ]}
      />
    );

    expect(
      screen.getByText('SDK 6.0.0 · sentry.javascript.react-native')
    ).toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('renders nothing when there are no SDK versions', () => {
    const {container} = render(<ReleaseCardSdkVersion sdkVersions={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
