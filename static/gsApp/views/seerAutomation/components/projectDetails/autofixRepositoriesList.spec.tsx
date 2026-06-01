import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RepositoryFixture} from 'sentry-fixture/repository';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import type {SeerProjectRepo} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerRepos';

import {AutofixRepositories} from 'getsentry/views/seerAutomation/components/projectDetails/autofixRepositoriesList';

// Needed to mock useVirtualizer lists in the add-repo modal.
jest.spyOn(window.Element.prototype, 'getBoundingClientRect').mockImplementation(() => ({
  x: 0,
  y: 0,
  width: 0,
  height: 30,
  left: 0,
  top: 0,
  right: 0,
  bottom: 0,
  toJSON: jest.fn(),
}));

const organization = OrganizationFixture();
const project = ProjectFixture();

function connectedRepoFixture(params: Partial<SeerProjectRepo> = {}): SeerProjectRepo {
  return {
    id: '10',
    repositoryId: '1',
    organizationId: organization.id,
    provider: 'integrations:github',
    owner: 'getsentry',
    name: 'sentry',
    externalId: '101',
    integrationId: '201',
    branchName: null,
    branchOverrides: [],
    instructions: null,
    ...params,
  };
}

function mockOrgRepos() {
  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/repos/`,
    method: 'GET',
    body: [
      RepositoryFixture({
        id: '1',
        name: 'getsentry/sentry',
        externalId: '101',
        provider: {id: 'integrations:github', name: 'GitHub'},
        integrationId: '201',
      }),
      RepositoryFixture({
        id: '2',
        name: 'getsentry/seer',
        externalId: '102',
        provider: {id: 'integrations:github', name: 'GitHub'},
        integrationId: '202',
      }),
    ],
  });
}

function mockConnectedRepos(body: SeerProjectRepo[]) {
  return MockApiClient.addMockResponse({
    url: `/projects/${organization.slug}/${project.slug}/seer/repos/`,
    method: 'GET',
    body,
  });
}

describe('AutofixRepositories (new project Seer UI)', () => {
  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders connected repos from the seer/repos endpoint', async () => {
    mockOrgRepos();
    mockConnectedRepos([connectedRepoFixture()]);

    render(<AutofixRepositories canWrite project={project} />, {organization});

    expect(await screen.findByText('getsentry/sentry')).toBeInTheDocument();
    expect(screen.getByText('integrations:github')).toBeInTheDocument();
  });

  it('adds a repository via POST with its repositoryId', async () => {
    mockOrgRepos();
    mockConnectedRepos([]);

    const addRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/repos/`,
      method: 'POST',
      status: 204,
    });

    render(<AutofixRepositories canWrite project={project} />, {organization});
    renderGlobalModal();

    await userEvent.click(
      await screen.findByRole('button', {name: 'Add Repositories to Project'})
    );

    const modal = await screen.findByRole('dialog');
    await userEvent.click(
      await within(modal).findByRole('button', {name: /getsentry\/sentry/})
    );
    await userEvent.click(within(modal).getByRole('button', {name: /Add 1 Repository/}));

    await waitFor(() => expect(addRequest).toHaveBeenCalled());
    expect(addRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({data: {repos: [{repositoryId: 1}]}})
    );
  });

  it('disconnects a repository via DELETE on its repositoryId', async () => {
    mockOrgRepos();
    mockConnectedRepos([connectedRepoFixture()]);

    const deleteRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/repos/1/`,
      method: 'DELETE',
      status: 204,
    });

    render(<AutofixRepositories canWrite project={project} />, {organization});
    renderGlobalModal();

    expect(await screen.findByText('getsentry/sentry')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Disconnect Repository'}));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByText('Disconnect'));

    await waitFor(() => expect(deleteRequest).toHaveBeenCalled());
  });

  it('updates a repo branch via PUT on its repositoryId', async () => {
    mockOrgRepos();
    mockConnectedRepos([connectedRepoFixture()]);

    const updateRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/repos/1/`,
      method: 'PUT',
      body: connectedRepoFixture({branchName: 'main'}),
    });

    render(<AutofixRepositories canWrite project={project} />, {organization});

    await userEvent.click(await screen.findByRole('button', {name: 'Expand'}));
    // Branch is persisted on blur, not per keystroke.
    await userEvent.type(screen.getByPlaceholderText('Default branch'), 'main');
    await userEvent.tab();

    await waitFor(() => expect(updateRequest).toHaveBeenCalled());
    expect(updateRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({data: {branchName: 'main'}})
    );
  });
});
