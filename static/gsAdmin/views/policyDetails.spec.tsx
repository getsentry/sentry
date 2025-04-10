import {PoliciesFixture} from 'getsentry-test/fixtures/policies';
import {PolicyRevisionsFixture} from 'getsentry-test/fixtures/policyRevisions';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

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

    expect(await screen.findAllByTestId('revision-actions')).toHaveLength(2);

    // Update current version
    const revisionsSection = screen.getAllByTestId('revision-actions')[0]!;
    await userEvent.click(within(revisionsSection).getAllByTestId('detail-actions')[0]!);
    await userEvent.click(screen.getByTestId('action-make-current'));

    expect(updateMock).toHaveBeenCalledWith(
      `/policies/${policy.slug}/revisions/${revisions[0]!.version}/`,
      expect.objectContaining({
        method: 'PUT',
        data: {current: true},
      })
    );
  });
});
