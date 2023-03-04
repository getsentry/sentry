import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import NarrowLayout from 'sentry/components/narrowLayout';

describe('NarrowLayout', function () {
  beforeAll(function () {
    jest.spyOn(window.location, 'assign').mockImplementation(() => {});
  });
  afterAll(function () {
    window.location.assign.mockRestore();
  });

  it('renders without logout', async function () {
    render(<NarrowLayout />);
    expect(screen.queryByText('Sign out')).not.toBeInTheDocument();
  });

  it('renders with logout', async function () {
    render(<NarrowLayout showLogout />);
    expect(screen.getByText('Sign out')).toBeInTheDocument();
  });

  it('can logout', async function () {
    const mock = MockApiClient.addMockResponse({
      url: '/auth/',
      method: 'DELETE',
      status: 204,
    });
    render(<NarrowLayout showLogout />);

    await userEvent.click(screen.getByText('Sign out'));
    expect(mock).toHaveBeenCalled();
  });
});
