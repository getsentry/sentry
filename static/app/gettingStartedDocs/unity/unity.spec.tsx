import {ProjectFixture} from 'sentry-fixture/project';

import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import docs from './unity';

function renderMockRequests() {
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/projects/',
    body: [ProjectFixture()],
  });
}

describe('unity onboarding docs', function () {
  it('renders docs correctly', async function () {
    renderMockRequests();

    renderWithOnboardingLayout(docs, {
      releaseRegistry: {
        'sentry.dotnet.unity': {
          version: '1.99.9',
        },
      },
    });

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Troubleshooting'})).toBeInTheDocument();

    // Renders SDK version from registry
    expect(
      await screen.findByText(
        textWithMarkupMatcher(/https:\/\/github.com\/getsentry\/unity\.git#1\.99\.9/)
      )
    ).toBeInTheDocument();
  });
});
