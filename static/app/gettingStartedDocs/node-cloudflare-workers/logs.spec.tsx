import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {LogsTabOnboarding} from 'sentry/views/explore/logs/logsOnboarding';

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
    url: `/projects/${organization.slug}/${project.slug}/`,
    method: 'GET',
    body: project,
  });
  MockApiClient.addMockResponse({
    url: `/customers/${organization.slug}/`,
    method: 'GET',
    body: {},
  });
  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/sdks/`,
    method: 'GET',
    body: [],
  });
  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/stats_v2/`,
    method: 'GET',
    body: {},
  });
}

describe('cloudflare logs onboarding', () => {
  it('shows a tab for each setup type on the Logs page', async () => {
    const organization = OrganizationFixture();
    const project = ProjectFixture({platform: 'node-cloudflare-workers'});
    renderMockRequests({organization, project});

    render(
      <LogsTabOnboarding
        datePageFilterProps={{}}
        organization={organization}
        project={project}
      />
    );

    expect(await screen.findByRole('heading', {name: /install/i})).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    expect(await screen.findByRole('button', {name: 'Vite Plugin'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Manual'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Pages'})).toBeInTheDocument();
    expect(screen.getByText(/Sentry\.defineCloudflareOptions/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Manual'}));
    expect(await screen.findByText(/Sentry\.withSentry\(/)).toBeInTheDocument();
  });
});
