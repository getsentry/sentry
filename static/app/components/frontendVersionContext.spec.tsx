import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import * as constants from 'sentry/constants';
import ConfigStore from 'sentry/stores/configStore';

import {FrontendVersionProvider, useFrontendVersion} from './frontendVersionContext';

jest.mock('sentry/constants', () => ({
  __esModule: true,
  DEPLOY_PREVIEW_CONFIG: undefined,
  NODE_ENV: 'production',
}));

function TestComponent() {
  const {state, deployedVersion, runningVersion} = useFrontendVersion();

  return (
    <div>
      <span data-test-id="state">{state}</span>
      <span data-test-id="deployed-version">{deployedVersion || 'null'}</span>
      <span data-test-id="running-version">{runningVersion || 'null'}</span>
    </div>
  );
}

const ONE_HOUR = 60 * 60 * 1000;

describe('FrontendVersionProvider', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    MockApiClient.clearMockResponses();
    ConfigStore.set('sentryMode', 'SAAS');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('provides state="current" when server version matches current version', async () => {
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

    // Advance past the initial delay before version checking starts
    act(() => jest.advanceTimersByTime(ONE_HOUR));

    expect(await screen.findByTestId('state')).toHaveTextContent('current');
    expect(await screen.findByTestId('deployed-version')).toHaveTextContent(commitSha);
    expect(await screen.findByTestId('running-version')).toHaveTextContent(commitSha);
  });

  it('provides state="stale" when server version differs from current version', async () => {
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

    // Advance past the initial delay before version checking starts
    act(() => jest.advanceTimersByTime(ONE_HOUR));

    expect(await screen.findByTestId('state')).toHaveTextContent('stale');
    expect(await screen.findByTestId('deployed-version')).toHaveTextContent(
      serverVersion
    );
    expect(await screen.findByTestId('running-version')).toHaveTextContent(
      currentCommitSha
    );
  });

  it('provides state="unknown" when server returns null version', async () => {
    const commitSha = 'c0ffee123456789abcdef0fedcba9876543210ab';
    const releaseVersion = `frontend@${commitSha}`;

    MockApiClient.addMockResponse({
      url: '/internal/frontend-version/',
      body: {version: null},
    });

    render(
      <FrontendVersionProvider releaseVersion={releaseVersion}>
        <TestComponent />
      </FrontendVersionProvider>
    );

    // Advance past the initial delay before version checking starts
    act(() => jest.advanceTimersByTime(ONE_HOUR));

    expect(await screen.findByTestId('state')).toHaveTextContent('unknown');
    expect(await screen.findByTestId('deployed-version')).toHaveTextContent('null');
    expect(await screen.findByTestId('running-version')).toHaveTextContent(commitSha);
  });

  it('provides forced state when force prop is set', async () => {
    render(
      <FrontendVersionProvider releaseVersion="frontend@abc123" force="stale">
        <TestComponent />
      </FrontendVersionProvider>
    );

    expect(await screen.findByTestId('state')).toHaveTextContent('stale');
    expect(await screen.findByTestId('deployed-version')).toHaveTextContent('null');
    expect(await screen.findByTestId('running-version')).toHaveTextContent('abc123');
  });

  it('provides state="disabled" when sentryMode is not SAAS', async () => {
    MockApiClient.addMockResponse({
      url: '/internal/frontend-version/',
      body: {version: 'server-version'},
    });

    // Mock ConfigStore to simulate non-SAAS environment
    ConfigStore.set('sentryMode', 'SELF_HOSTED');

    render(
      <FrontendVersionProvider releaseVersion="frontend@abc123">
        <TestComponent />
      </FrontendVersionProvider>
    );

    expect(await screen.findByTestId('state')).toHaveTextContent('disabled');
    expect(await screen.findByTestId('deployed-version')).toHaveTextContent('null');
    expect(await screen.findByTestId('running-version')).toHaveTextContent('abc123');
  });

  it('provides state="disabled" when NODE_ENV is not production', async () => {
    jest.mocked(constants).NODE_ENV = 'development';

    MockApiClient.addMockResponse({
      url: '/internal/frontend-version/',
      body: {version: 'server-version'},
    });

    render(
      <FrontendVersionProvider releaseVersion="frontend@abc123">
        <TestComponent />
      </FrontendVersionProvider>
    );

    expect(await screen.findByTestId('state')).toHaveTextContent('disabled');
    expect(await screen.findByTestId('deployed-version')).toHaveTextContent('null');
    expect(await screen.findByTestId('running-version')).toHaveTextContent('abc123');
  });

  it('provides state="disabled" when DEPLOY_PREVIEW_CONFIG is defined', async () => {
    jest.mocked(constants).DEPLOY_PREVIEW_CONFIG = {
      branch: 'test-branch',
      commitSha: 'abdc',
      githubOrg: 'getsentry',
      githubRepo: 'sentry',
    };

    MockApiClient.addMockResponse({
      url: '/internal/frontend-version/',
      body: {version: 'server-version'},
    });

    render(
      <FrontendVersionProvider releaseVersion="frontend@abc123">
        <TestComponent />
      </FrontendVersionProvider>
    );

    expect(await screen.findByTestId('state')).toHaveTextContent('disabled');
    expect(await screen.findByTestId('deployed-version')).toHaveTextContent('null');
    expect(await screen.findByTestId('running-version')).toHaveTextContent('abc123');
  });
});
