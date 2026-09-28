import {PoliciesFixture} from 'getsentry-test/fixtures/policies';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Policies} from 'admin/views/policies';

describe('Policies', () => {
  it('loads inactive policies in the admin table', async () => {
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

    render(<Policies />);

    expect(await screen.findByText('Inactive Policy')).toBeInTheDocument();
    expect(listMock).toHaveBeenCalledWith(
      '/policies/',
      expect.objectContaining({data: expect.objectContaining({include: 'all'})})
    );
  });
});
