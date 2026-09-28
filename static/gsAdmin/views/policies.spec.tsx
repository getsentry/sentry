import {PoliciesFixture} from 'getsentry-test/fixtures/policies';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {Policies} from 'admin/views/policies';

describe('Policies', () => {
  it('shows active policies by default and allows showing all policies', async () => {
    const inactivePolicy = {
      ...PoliciesFixture().terms!,
      active: false,
      name: 'Inactive Policy',
      updatedAt: null,
      version: null,
    };
    const listMock = MockApiClient.addMockResponse({
      url: '/policies/',
      body: [inactivePolicy],
    });

    const {router} = render(<Policies />, {
      initialRouterConfig: {location: {pathname: '/_admin/policies/'}},
    });

    expect(await screen.findByText('Inactive Policy')).toBeInTheDocument();
    expect(listMock).toHaveBeenCalledWith(
      '/policies/',
      expect.objectContaining({data: expect.objectContaining({include: 'active'})})
    );

    await userEvent.click(screen.getByRole('button', {name: /Show Active policies/}));
    await userEvent.click(screen.getByRole('option', {name: 'All policies'}));

    await waitFor(() =>
      expect(listMock).toHaveBeenCalledWith(
        '/policies/',
        expect.objectContaining({data: expect.objectContaining({include: 'all'})})
      )
    );
    expect(router.location.query.include).toBe('all');
  });

  it('restores the all policies filter from the URL', async () => {
    const listMock = MockApiClient.addMockResponse({url: '/policies/', body: []});

    render(<Policies />, {
      initialRouterConfig: {
        location: {pathname: '/_admin/policies/', query: {include: 'all'}},
      },
    });

    await waitFor(() =>
      expect(listMock).toHaveBeenCalledWith(
        '/policies/',
        expect.objectContaining({data: expect.objectContaining({include: 'all'})})
      )
    );
    expect(screen.getByRole('button', {name: /Show All policies/})).toBeInTheDocument();
  });
});
