import {Organization} from 'sentry-fixture/organization';
import {Tags} from 'sentry-fixture/tags';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import ProjectTags from 'sentry/views/settings/projectTags';

describe('ProjectTags', function () {
  const {organization: org, project, routerProps} = initializeOrg();

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/tags/`,
      method: 'GET',
      body: Tags(),
    });
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/tags/browser/`,
      method: 'DELETE',
    });
  });

  it('renders', function () {
    render(<ProjectTags {...routerProps} organization={org} project={project} />);
  });

  it('renders empty', function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/tags/`,
      method: 'GET',
      body: [],
    });

    render(<ProjectTags {...routerProps} organization={org} project={project} />);
    expect(screen.getByTestId('empty-message')).toBeInTheDocument();
  });

  it('disables delete button for users without access', function () {
    render(<ProjectTags {...routerProps} organization={org} project={project} />, {
      organization: Organization({access: []}),
    });

    screen
      .getAllByRole('button', {name: 'Remove tag'})
      .forEach(button => expect(button).toBeDisabled());
  });

  it('deletes tag', async function () {
    render(<ProjectTags {...routerProps} organization={org} project={project} />);

    // First tag exists
    const tagCount = screen.getAllByTestId('tag-row').length;

    // Remove the first tag
    await userEvent.click(screen.getAllByRole('button', {name: 'Remove tag'})[0]);

    // Press confirm in modal
    renderGlobalModal();
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    // Wait for the tag to have been removed in the store
    await waitFor(() =>
      expect(screen.getAllByTestId('tag-row')).toHaveLength(tagCount - 1)
    );
  });
});
