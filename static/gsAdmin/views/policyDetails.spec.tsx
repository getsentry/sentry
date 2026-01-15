import {PoliciesFixture} from 'getsentry-test/fixtures/policies';
import {PolicyRevisionsFixture} from 'getsentry-test/fixtures/policyRevisions';
// import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

// import PolicyDetails from 'admin/views/policyDetails';

describe('PolicyDetails', () => {
  const revisions = PolicyRevisionsFixture();
  const policies = PoliciesFixture();
  const policy = policies.terms!;

  beforeEach(() => {
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

  // TODO: Re-enable test after fixing useParams mock strategy
  // Test was disabled during deprecatedRouteProps removal
  // it('can update current version', async () => {
  //   const updateMock = MockApiClient.addMockResponse({
  //     url: `/policies/${policy.slug}/revisions/${revisions[0]!.version}/`,
  //     method: 'PUT',
  //   });

  //   // TODO: Need to figure out proper way to pass params to useParams in tests
  //   render(<PolicyDetails />);

  //   const buttons = await screen.findAllByText('Make current');
  //   // Update current version
  //   await userEvent.click(buttons[0]!);

  //   expect(updateMock).toHaveBeenCalledWith(
  //     `/policies/${policy.slug}/revisions/${revisions[0]!.version}/`,
  //     expect.objectContaining({
  //       method: 'PUT',
  //       data: {current: true},
  //     })
  //   );
  // });
});
