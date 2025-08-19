import {render, screen} from 'sentry-test/reactTestingLibrary';

import {FrontendVersionProvider, useFrontendVersion} from './frontendVersionContext';

function TestComponent() {
  const {stale, deployedVersion} = useFrontendVersion();

  return (
    <div>
      <span data-test-id="stale">{stale.toString()}</span>
      <span data-test-id="deployed-version">{deployedVersion || 'null'}</span>
    </div>
  );
}

describe('FrontendVersionProvider', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('provides stale=false when server version matches current version', async () => {
    const commitSha = 'deadbeefcafebabe1234567890abcdef12345678';
    const releaseVersion = `frontend@${commitSha}`;

    MockApiClient.addMockResponse({
      url: '/internal/frontend-version/',
      body: {version: commitSha},
    });

    render(
      <FrontendVersionProvider releaseVersion={releaseVersion}>
        <TestComponent />
      </FrontendVersionProvider>
    );

    expect(await screen.findByTestId('stale')).toHaveTextContent('false');
    expect(await screen.findByTestId('deployed-version')).toHaveTextContent(commitSha);
  });

  it('provides stale=true when server version differs from current version', async () => {
    const currentCommitSha = 'feedface123456789abcdef0fedcba9876543210';
    const serverVersion = 'beefdead987654321fedcba0123456789abcdef0';
    const releaseVersion = `frontend@${currentCommitSha}`;

    MockApiClient.addMockResponse({
      url: '/internal/frontend-version/',
      body: {version: serverVersion},
    });

    render(
      <FrontendVersionProvider releaseVersion={releaseVersion}>
        <TestComponent />
      </FrontendVersionProvider>
    );

    expect(await screen.findByTestId('stale')).toHaveTextContent('true');
    expect(await screen.findByTestId('deployed-version')).toHaveTextContent(
      serverVersion
    );
  });

  it('provides stale=false when server returns null version', async () => {
    const releaseVersion = 'frontend@c0ffee123456789abcdef0fedcba9876543210ab';

    MockApiClient.addMockResponse({
      url: '/internal/frontend-version/',
      body: {version: null},
    });

    render(
      <FrontendVersionProvider releaseVersion={releaseVersion}>
        <TestComponent />
      </FrontendVersionProvider>
    );

    expect(await screen.findByTestId('stale')).toHaveTextContent('false');
    expect(await screen.findByTestId('deployed-version')).toHaveTextContent('null');
  });

  it('provides stale=true when forceStale prop is set', async () => {
    render(
      <FrontendVersionProvider releaseVersion="frontend@abc123" forceStale>
        <TestComponent />
      </FrontendVersionProvider>
    );

    expect(await screen.findByTestId('stale')).toHaveTextContent('true');
    expect(await screen.findByTestId('deployed-version')).toHaveTextContent('null');
  });
});
