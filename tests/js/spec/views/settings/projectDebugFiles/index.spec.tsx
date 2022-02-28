import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountGlobalModal} from 'sentry-test/modal';
import {mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectDebugFiles from 'sentry/views/settings/projectDebugFiles';

describe('ProjectDebugFiles', function () {
  const {organization, project, router} = initializeOrg();

  const props = {
    organization,
    project,
    params: {orgId: organization.slug, projectId: project.slug},
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
      body: [TestStubs.DebugFile()],
    });
  });

  it('renders', function () {
    mountWithTheme(<ProjectDebugFiles {...props} />);

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

    mountWithTheme(<ProjectDebugFiles {...props} />);

    // Uploaded debug files content
    expect(
      screen.getByText('There are no debug symbols for this project.')
    ).toBeInTheDocument();
  });

  it('deletes the file', async function () {
    const deleteMock = MockApiClient.addMockResponse({
      method: 'DELETE',
      url: `/projects/${organization.slug}/${project.slug}/files/dsyms/?id=${
        TestStubs.DebugFile().id
      }`,
    });

    mountWithTheme(<ProjectDebugFiles {...props} />);

    // Delete button
    userEvent.click(screen.getByTestId('delete-dif'));

    // Confirm Modal
    mountGlobalModal();
    await screen.findByRole('dialog');

    userEvent.click(screen.getByTestId('confirm-button'));

    expect(deleteMock).toHaveBeenCalled();
  });
});
