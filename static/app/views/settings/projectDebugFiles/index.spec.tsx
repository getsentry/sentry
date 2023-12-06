import {DebugFile} from 'sentry-fixture/debugFile';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import ProjectDebugFiles from 'sentry/views/settings/projectDebugFiles';

describe('ProjectDebugFiles', function () {
  const {organization, project, router} = initializeOrg();

  const props = {
    organization,
    project,
    params: {projectId: project.slug},
    location: {
      ...router.location,
      query: {
        query: '',
      },
    },
    route: {},
    router,
    routes: [],
    routeParams: {},
  };

  const endpoint = `/projects/${organization.slug}/${project.slug}/files/dsyms/`;

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: endpoint,
      body: [DebugFile()],
    });
  });

  it('renders', function () {
    render(<ProjectDebugFiles {...props} />);

    expect(screen.getByText('Debug Information Files')).toBeInTheDocument();

    // Uploaded debug files content
    expect(screen.getByText('Uploaded debug information files')).toBeInTheDocument();
    expect(screen.getByText('libS.so')).toBeInTheDocument();
  });

  it('renders empty', function () {
    MockApiClient.addMockResponse({
      url: endpoint,
      body: [],
    });

    render(<ProjectDebugFiles {...props} />);

    // Uploaded debug files content
    expect(
      screen.getByText('There are no debug symbols for this project.')
    ).toBeInTheDocument();
  });

  it('deletes the file', async function () {
    const deleteMock = MockApiClient.addMockResponse({
      method: 'DELETE',
      url: `/projects/${organization.slug}/${project.slug}/files/dsyms/?id=${
        DebugFile().id
      }`,
    });

    render(<ProjectDebugFiles {...props} />);
    renderGlobalModal();

    // Delete button
    await userEvent.click(screen.getByTestId('delete-dif'));

    // Confirm Modal
    await screen.findByRole('dialog');

    await userEvent.click(screen.getByTestId('confirm-button'));

    expect(deleteMock).toHaveBeenCalled();
  });
});
