import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {MetricsTabOnboarding} from 'sentry/views/explore/metrics/metricsOnboarding';

function renderMockRequests({
  organization,
  project,
}: {
  organization: Organization;
  project: Project;
}) {
  MockApiClient.addMockResponse({
    url: `/projects/${organization.slug}/${project.slug}/keys/`,
    method: 'GET',
    body: [ProjectKeysFixture()[0]],
  });
  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/sdks/`,
    method: 'GET',
    body: [],
  });
}

describe('getting started with react-native', () => {
  it.knownFlake('shows React Native metrics onboarding content', async () => {
    const organization = OrganizationFixture();
    const project = ProjectFixture({platform: 'react-native'});
    renderMockRequests({organization, project});

    render(
      <MetricsTabOnboarding
        datePageFilterProps={{}}
        organization={organization}
        project={project}
      />
    );

    expect(
      await screen.findByRole('heading', {name: /install sentry/i})
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: /configure sentry/i})).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {name: /send metrics and verify/i})
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));
    expect(await screen.findByText(/Metrics are enabled by default/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));
    expect(await screen.findByText(/Sentry\.metrics\.count/)).toBeInTheDocument();
    expect(screen.getByText(/Sentry\.metrics\.gauge/)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Sentry\.metrics\.count/)).toBeInTheDocument();
    });
  });
});
