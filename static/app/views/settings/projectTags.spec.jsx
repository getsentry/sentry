import {Organization} from 'fixtures/js-stubs/organization';
import {Project} from 'fixtures/js-stubs/project';
import {routerContext} from 'fixtures/js-stubs/routerContext';
import {Tags} from 'fixtures/js-stubs/tags';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import ProjectTags from 'sentry/views/settings/projectTags';

describe('ProjectTags', function () {
  let org, project;

  beforeEach(function () {
    org = Organization();
    project = Project();

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
    const {container} = render(
      <ProjectTags params={{orgId: org.slug, projectId: project.slug}} />
    );

    expect(container).toSnapshot();
  });

  it('renders empty', function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/tags/`,
      method: 'GET',
      body: [],
    });

    render(<ProjectTags params={{orgId: org.slug, projectId: project.slug}} />);
    expect(screen.getByTestId('empty-message')).toBeInTheDocument();
  });

  it('disables delete button for users without access', function () {
    const context = {
      organization: Organization({access: []}),
    };

    render(<ProjectTags params={{orgId: org.slug, projectId: project.slug}} />, {
      context: routerContext([context]),
    });

    screen
      .getAllByRole('button', {name: 'Remove tag'})
      .forEach(button => expect(button).toBeDisabled());
  });

  it('deletes tag', async function () {
    render(<ProjectTags params={{orgId: org.slug, projectId: project.slug}} />);

    // First tag exists
    const tagCount = screen.getAllByTestId('tag-row').length;

    // Remove the first tag
    userEvent.click(screen.getAllByRole('button', {name: 'Remove tag'})[0]);

    // Press confirm in modal
    renderGlobalModal();
    userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    // Wait for the tag to have been removed in the store
    await waitFor(() =>
      expect(screen.getAllByTestId('tag-row')).toHaveLength(tagCount - 1)
    );
  });
});
