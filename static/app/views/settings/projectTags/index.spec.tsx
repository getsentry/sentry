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
  const {organization: org, project, routerProps} = initializeOrg();

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
    render(<ProjectTags {...routerProps} />);
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

    render(<ProjectTags {...routerProps} />);
    expect(await screen.findByTestId('empty-message')).toBeInTheDocument();
  });

  it('disables delete button for users without access', async () => {
    render(<ProjectTags {...routerProps} />, {
      organization: OrganizationFixture({access: []}),
    });

    (await screen.findAllByRole('button', {name: 'Remove tag'})).forEach(button =>
      expect(button).toBeDisabled()
    );
  });

  it('deletes tag', async () => {
    render(<ProjectTags {...routerProps} />);

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
