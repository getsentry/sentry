import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import AdminProjects from 'sentry/views/admin/adminProjects';

describe('AdminProjects', () => {
  it('loads filtered projects and renders their details in a table', async () => {
    const organization = OrganizationFixture({
      name: 'Example Organization',
      slug: 'example',
    });
    const project = ProjectFixture({
      name: 'Example Project',
      slug: 'sample',
      organization,
    });
    const request = MockApiClient.addMockResponse({
      url: '/projects/',
      body: [{...project, status: 'deleted'}],
    });

    render(<AdminProjects />, {
      initialRouterConfig: {
        location: {
          pathname: '/manage/projects/',
          query: {status: 'deleted'},
        },
      },
    });

    expect(await screen.findByRole('link', {name: 'Example Project'})).toHaveAttribute(
      'href',
      '/example/sample/'
    );
    expect(screen.getByRole('columnheader', {name: 'Status'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Created'})).toBeInTheDocument();
    expect(screen.getByText('deleted')).toBeInTheDocument();
    expect(screen.getByText('Example Organization')).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith(
      '/projects/',
      expect.objectContaining({
        query: expect.objectContaining({show: 'all', status: 'deleted'}),
      })
    );
  });
});
