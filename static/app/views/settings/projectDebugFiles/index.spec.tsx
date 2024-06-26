import {DebugFileFixture} from 'sentry-fixture/debugFile';

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
      body: [DebugFileFixture()],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/builtin-symbol-sources/`,
      method: 'GET',
      body: [],
    });
  });

  it('renders', async function () {
    render(<ProjectDebugFiles {...props} />);

    expect(screen.getByText('Debug Information Files')).toBeInTheDocument();

    // Uploaded debug files content
    expect(
      await screen.findByText('Uploaded debug information files')
    ).toBeInTheDocument();
    expect(screen.getByText('libS.so')).toBeInTheDocument();
  });

  it('renders empty', async function () {
    MockApiClient.addMockResponse({
      url: endpoint,
      body: [],
    });

    render(<ProjectDebugFiles {...props} />);

    // Uploaded debug files content
    expect(
      await screen.findByText('There are no debug symbols for this project.')
    ).toBeInTheDocument();
  });

  it('deletes the file', async function () {
    const deleteMock = MockApiClient.addMockResponse({
      method: 'DELETE',
      url: `/projects/${organization.slug}/${project.slug}/files/dsyms/?id=${
        DebugFileFixture().id
      }`,
    });

    render(<ProjectDebugFiles {...props} />);
    renderGlobalModal();

    // Delete button
    await userEvent.click(await screen.findByTestId('delete-dif'));

    // Confirm Modal
    await screen.findByRole('dialog');

    await userEvent.click(screen.getByTestId('confirm-button'));

    expect(deleteMock).toHaveBeenCalled();
  });

  it('display error if request for dsyms fails', async function () {
    MockApiClient.addMockResponse({
      url: endpoint,
      body: [DebugFileFixture()],
      statusCode: 400,
    });

    render(<ProjectDebugFiles {...props} />);

    expect(await screen.findByText(/There was an error/)).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Retry'})).toBeInTheDocument();
  });

  it('display error if request for symbol sources fails', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/builtin-symbol-sources/`,
      method: 'GET',
      body: [],
      statusCode: 400,
    });

    render(
      <ProjectDebugFiles
        {...props}
        organization={{...organization, features: ['symbol-sources']}}
      />
    );

    expect(await screen.findByText(/There was an error/)).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Retry'})).toBeInTheDocument();
  });
});
