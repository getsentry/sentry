import {ProjectFixture} from 'sentry-fixture/project';

import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';

import docs from './minidump';

function renderMockRequests() {
  MockApiClient.addMockResponse({
    url: '/projects/org-slug/project-slug/',
    body: [ProjectFixture()],
  });
}

describe('getting started with minidump', function () {
  it('renders gradle docs correctly', function () {
    renderMockRequests();

    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(
      screen.getByRole('heading', {name: 'Creating and Uploading Minidumps'})
    ).toBeInTheDocument();
  });
});
