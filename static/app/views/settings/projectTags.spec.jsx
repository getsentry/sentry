import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import ProjectTags from 'sentry/views/settings/projectTags';

describe('ProjectTags', function () {
  const tags = TestStubs.Tags();
  const org = TestStubs.Organization();
  const project = TestStubs.Project();
  let deleteApi;

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/tags/`,
      method: 'GET',
      body: tags,
    });
    deleteApi = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/tags/browser/`,
      method: 'DELETE',
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('renders', function () {
    const wrapper = render(
      <ProjectTags params={{orgId: org.slug, projectId: project.slug}} />
    );

    expect(screen.getAllByTestId('tag-row')).toHaveLength(5);
    expect(wrapper.container).toSnapshot();
  });

  it('renders empty', function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/tags/`,
      method: 'GET',
      body: [],
    });

    render(<ProjectTags params={{orgId: org.slug, projectId: project.slug}} />);

    expect(screen.getByText(/There are no tags/)).toBeInTheDocument();
  });

  it('disables delete button for users without access', function () {
    render(<ProjectTags params={{orgId: org.slug, projectId: project.slug}} />, {
      context: TestStubs.routerContext([
        {organization: TestStubs.Organization({access: []})},
      ]),
    });

    expect(screen.getAllByLabelText('Remove tag').at(0)).toBeDisabled();
  });

  it('deletes tag', async function () {
    render(<ProjectTags params={{orgId: org.slug, projectId: project.slug}} />);
    renderGlobalModal();

    expect(screen.getAllByTestId('tag-row')).toHaveLength(tags.length);
    userEvent.click(screen.getAllByRole('button', {name: 'Remove tag'}).at(0));

    // Press confirm in modal
    userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    await waitFor(() =>
      expect(screen.getAllByTestId('tag-row')).toHaveLength(tags.length - 1)
    );
    expect(deleteApi).toHaveBeenCalledWith(
      `/projects/${org.slug}/${project.slug}/tags/browser/`,
      expect.anything()
    );
  });
});
