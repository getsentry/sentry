import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RepositoryFixture} from 'sentry-fixture/repository';

import {
  act,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import type {SeerPreferencesResponse} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import ModalStore from 'sentry/stores/modalStore';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import ProjectSeer from 'sentry/views/settings/projectSeer';

// Needed to mock useVirtualizer lists.
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

describe('ProjectSeer', function () {
  let project: Project;
  let organization: Organization;

  beforeEach(() => {
    ModalStore.init();
    project = ProjectFixture();
    organization = OrganizationFixture({
      features: ['autofix-seer-preferences', 'trigger-autofix-on-issue-summary'],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      query: {status: 'active'},
      method: 'GET',
      body: [
        RepositoryFixture({
          id: '1',
          name: 'getsentry/sentry',
          externalId: '101',
          provider: {id: 'github', name: 'GitHub'},
        }),
        RepositoryFixture({
          id: '2',
          name: 'getsentry/seer',
          externalId: '102',
          provider: {id: 'github', name: 'GitHub'},
        }),
      ],
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      method: 'GET',
      body: {
        ...project,
        options: {
          'sentry:seer_optimization': {
            repositories: [
              {
                provider: 'github',
                owner: 'getsentry',
                name: 'sentry',
                external_id: '101',
                branch_name: 'main',
                instructions: '',
              },
            ],
          },
        },
      },
    });

    const seerPreferencesResponse: SeerPreferencesResponse = {
      code_mapping_repos: [
        {
          provider: 'github',
          owner: 'getsentry',
          name: 'sentry',
          external_id: '101',
        },
      ],
    };

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
      method: 'GET',
      body: seerPreferencesResponse,
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('can add a repository', async function () {
    const seerPreferencesPostRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
      method: 'POST',
    });

    render(<ProjectSeer project={project} />, {organization});
    renderGlobalModal();

    // Wait for initial repos to load
    expect(await screen.findByText('getsentry/sentry')).toBeInTheDocument();
    expect(screen.queryByText('getsentry/seer')).not.toBeInTheDocument();

    // Open the add repo modal
    await userEvent.click(screen.getByRole('button', {name: 'Add Repos'}));

    // Find and select the unselected repo in the modal
    const modal = await screen.findByRole('dialog');
    await userEvent.click(
      await within(modal).findByRole('button', {name: /getsentry\/seer/})
    );

    // Save changes in the modal
    await userEvent.click(within(modal).getByRole('button', {name: 'Add 1 Repository'}));

    // Wait for modal to close and repo list to update
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await screen.findByText('getsentry/seer')).toBeInTheDocument();

    await waitFor(() => {
      expect(seerPreferencesPostRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            repositories: [
              {
                branch_name: '',
                external_id: '101',
                instructions: '',
                name: 'sentry',
                owner: 'getsentry',
                provider: 'github',
              },
              {
                branch_name: '',
                external_id: '102',
                instructions: '',
                name: 'seer',
                owner: 'getsentry',
                provider: 'github',
              },
            ],
          },
        })
      );
    });
    expect(seerPreferencesPostRequest).toHaveBeenCalledTimes(1);
  });

  it('can update repository settings', async function () {
    const seerPreferencesPostRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
      method: 'POST',
    });

    render(<ProjectSeer project={project} />, {organization});
    renderGlobalModal();

    const repoItem = await screen.findByText('getsentry/sentry');

    // Expand the repo item
    await userEvent.click(repoItem);

    // Find input fields
    const branchInput = screen.getByPlaceholderText('Default branch');
    const instructionsInput = screen.getByPlaceholderText(
      'Any special instructions for Autofix in this repository...'
    );

    await userEvent.type(branchInput, 'develop');
    await userEvent.type(instructionsInput, 'Use Conventional Commits');

    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    await waitFor(() => {
      expect(seerPreferencesPostRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            repositories: [
              {
                external_id: '101',
                name: 'sentry',
                owner: 'getsentry',
                provider: 'github',
                branch_name: 'develop',
                instructions: 'Use Conventional Commits',
              },
            ],
          },
        })
      );
    });
    expect(seerPreferencesPostRequest).toHaveBeenCalledTimes(1);
  });

  it('can remove a repository', async function () {
    const seerPreferencesPostRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
      method: 'POST',
    });

    render(<ProjectSeer project={project} />, {organization});
    renderGlobalModal();

    const repoItem = await screen.findByText('getsentry/sentry');

    // Open the row and click remove
    await userEvent.click(repoItem);
    await userEvent.click(screen.getByRole('button', {name: 'Remove Repository'}));

    // Wait for the repo to disappear
    await waitFor(() => {
      expect(screen.queryByText('getsentry/sentry')).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(seerPreferencesPostRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            repositories: [],
          },
        })
      );
    });
    expect(seerPreferencesPostRequest).toHaveBeenCalledTimes(1);
  });

  it('can update the autofix autorun threshold slider', async function () {
    const initialProject = {
      ...project,
      autofixAutorunThreshold: 'medium', // Start from medium
    };

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      method: 'GET',
      body: initialProject,
    });

    const projectPutRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      method: 'PUT',
      body: {},
    });

    render(<ProjectSeer project={initialProject} />, {organization});

    const slider = await screen.findByRole('slider', {
      name: /Autofix Autorun Confidence Threshold/i,
    });

    act(() => {
      slider.focus();
    });

    await userEvent.keyboard('{ArrowRight}');

    // Form has saveOnBlur=true, so wait for the PUT request
    await waitFor(() => {
      expect(projectPutRequest).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(projectPutRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({data: {autofixAutorunThreshold: 'high'}})
      );
    });
  });
});
