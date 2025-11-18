import {OrganizationFixture} from 'sentry-fixture/organization';
import {TagsFixture} from 'sentry-fixture/tags';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import ProjectTags from 'sentry/views/settings/projectTags';

describe('ProjectTags', () => {
  const {organization: org, project} = initializeOrg();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      body: project,
    });
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/tags/`,
      method: 'GET',
      body: TagsFixture(),
    });
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/tags/browser/`,
      method: 'DELETE',
    });
  });

  it('renders', () => {
    render(<ProjectTags />, {
      organization: org,
      outletContext: {project},
      initialRouterConfig: {
        location: {
          pathname: `/settings/projects/${project.slug}/tags/`,
        },
        route: '/settings/projects/:projectId/tags/',
      },
    });
  });

  it('renders empty', async () => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      body: project,
    });
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/tags/`,
      method: 'GET',
      body: [],
    });

    render(<ProjectTags />, {
      organization: org,
      outletContext: {project},
      initialRouterConfig: {
        location: {
          pathname: `/settings/projects/${project.slug}/tags/`,
        },
        route: '/settings/projects/:projectId/tags/',
      },
    });
    expect(await screen.findByTestId('empty-message')).toBeInTheDocument();
  });

  it('disables delete button for users without access', async () => {
    render(<ProjectTags />, {
      organization: OrganizationFixture({access: []}),
      outletContext: {project},
      initialRouterConfig: {
        location: {
          pathname: `/settings/projects/${project.slug}/tags/`,
        },
        route: '/settings/projects/:projectId/tags/',
      },
    });

    (await screen.findAllByRole('button', {name: 'Remove tag'})).forEach(button =>
      expect(button).toBeDisabled()
    );
  });

  it('deletes tag', async () => {
    render(<ProjectTags />, {
      organization: org,
      outletContext: {project},
      initialRouterConfig: {
        location: {
          pathname: `/settings/projects/${project.slug}/tags/`,
        },
        route: '/settings/projects/:projectId/tags/',
      },
    });

    // First tag exists
    const tagCount = (await screen.findAllByTestId('tag-row')).length;

    expect(tagCount).toBe(5);

    // Remove the first tag
    await userEvent.click(screen.getAllByRole('button', {name: 'Remove tag'})[0]!);

    // Press confirm in modal
    renderGlobalModal();
    await userEvent.click(await screen.findByTestId('confirm-button'));

    // Wait for the tag to have been removed in the store
    expect(await screen.findAllByTestId('tag-row')).toHaveLength(tagCount - 1);
  });
});
