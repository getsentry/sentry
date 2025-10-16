import {OrganizationsFixture} from 'sentry-fixture/organizations';

import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import OrganizationsStore from 'sentry/stores/organizationsStore';

import OrganizationsSource from './organizationsSource';

describe('OrganizationsSource', () => {
  const orgs = OrganizationsFixture();

  beforeEach(() => {
    OrganizationsStore.load(orgs);
  });

  it('can find an org to switch to', async () => {
    const mock = jest.fn().mockReturnValue(null);

    render(<OrganizationsSource query="test-1">{mock}</OrganizationsSource>);

    await waitFor(() => {
      const calls = mock.mock.calls;
      expect(calls[calls.length - 1][0].results[0].item).toEqual({
        description: 'Switch to the test-1 organization',
        resultType: 'route',
        sourceType: 'organization',
        title: 'test 1',
        to: '/test-1/',
        model: expect.anything(),
        resolvedTs: expect.anything(),
      });
    });
  });

  it('does not find any orgs', async () => {
    const mock = jest.fn().mockReturnValue(null);
    render(<OrganizationsSource query="invalid">{mock}</OrganizationsSource>);

    await waitFor(() =>
      expect(mock).toHaveBeenCalledWith(expect.objectContaining({results: []}))
    );
  });
});
