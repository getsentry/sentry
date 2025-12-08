import {ProjectFixture} from 'sentry-fixture/project';

import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';

import docs from '.';

function renderMockRequests() {
  MockApiClient.addMockResponse({
    url: '/projects/org-slug/project-slug/',
    body: [ProjectFixture()],
  });
}

describe('getting started with unreal', () => {
  it('renders docs correctly', () => {
    renderMockRequests();

    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {name: 'Upload Debug Symbols'})
    ).toBeInTheDocument();
  });
});
