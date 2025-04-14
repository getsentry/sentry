import {PoliciesFixture} from 'getsentry-test/fixtures/policies';
import {PolicyRevisionsFixture} from 'getsentry-test/fixtures/policyRevisions';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import PolicyDetails from 'admin/views/policyDetails';

describe('PolicyDetails', function () {
  const revisions = PolicyRevisionsFixture();
  const policies = PoliciesFixture();
  const policy = policies.terms!;
  const {routerProps, router} = initializeOrg({
    router: {params: {policySlug: policy.slug}},
  });

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/policies/${policy.slug}/`,
      body: policy,
    });
    MockApiClient.addMockResponse({
      url: `/policies/${policy.slug}/revisions/`,
      body: revisions,
    });
  });

  it('can update current version', async function () {
    const updateMock = MockApiClient.addMockResponse({
      url: `/policies/${policy.slug}/revisions/${revisions[0]!.version}/`,
      method: 'PUT',
    });

    render(<PolicyDetails {...routerProps} />, {router});

    const buttons = await screen.findAllByText('Make current');
    // Update current version
    await userEvent.click(buttons[0]!);

    expect(updateMock).toHaveBeenCalledWith(
      `/policies/${policy.slug}/revisions/${revisions[0]!.version}/`,
      expect.objectContaining({
        method: 'PUT',
        data: {current: true},
      })
    );
  });
});
