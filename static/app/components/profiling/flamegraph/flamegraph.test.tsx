import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {useParams} from 'sentry/utils/useParams';
import ProfileFlamegraph from 'sentry/views/profiling/profileFlamechart';
import ProfilesAndTransactionProvider from 'sentry/views/profiling/profilesProvider';

jest.mock('sentry/utils/useParams', () => ({
  useParams: jest.fn(),
}));

window.ResizeObserver =
  window.ResizeObserver ||
  jest.fn().mockImplementation(() => ({
    disconnect: jest.fn(),
    observe: jest.fn(),
    unobserve: jest.fn(),
  }));

Element.prototype.scrollTo = () => {};

// Replace the webgl renderer with a dom renderer for tests
jest.mock('sentry/utils/profiling/renderers/flamegraphRendererWebGL', () => {
  const {
    FlamegraphRendererDOM,
  } = require('sentry/utils/profiling/renderers/flamegraphRendererDOM');

  return {
    FlamegraphRendererWebGL: FlamegraphRendererDOM,
  };
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe('Flamegraph', function () {
  it('renders', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [TestStubs.Project({slug: 'foo-project'})],
    });

    MockApiClient.addMockResponse({
      url: '/projects/org-slug/foo-project/profiling/profiles/profile-id/',
      statusCode: 404,
    });

    (useParams as jest.Mock).mockReturnValue({
      orgId: 'org-slug',
      projectId: 'foo-project',
      eventId: 'profile-id',
    });

    render(
      <ProfilesAndTransactionProvider>
        <ProfileFlamegraph />
      </ProfilesAndTransactionProvider>,
      {organization: initializeOrg().organization}
    );

    expect(await screen.findByText('Error: Unable to load profiles')).toBeInTheDocument();
  });
});
