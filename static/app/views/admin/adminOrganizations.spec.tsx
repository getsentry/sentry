import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import AdminOrganizations from 'sentry/views/admin/adminOrganizations';

describe('AdminOrganizations', () => {
  it('loads organizations with the selected sort and renders them in a table', async () => {
    const organization = OrganizationFixture({
      name: 'Example Organization',
      slug: 'example',
    });
    const request = MockApiClient.addMockResponse({
      url: '/organizations/',
      body: [organization],
    });

    render(<AdminOrganizations />, {
      initialRouterConfig: {
        location: {
          pathname: '/manage/organizations/',
          query: {sortBy: 'members'},
        },
      },
    });

    expect(
      await screen.findByRole('link', {name: 'Example Organization'})
    ).toHaveAttribute('href', '/example/');
    expect(screen.getByRole('columnheader', {name: 'Organization'})).toBeInTheDocument();
    expect(screen.getByText('example')).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith(
      '/organizations/',
      expect.objectContaining({
        query: expect.objectContaining({show: 'all', sortBy: 'members'}),
      })
    );
  });
});
