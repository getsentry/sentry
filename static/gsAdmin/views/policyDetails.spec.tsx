import {UserFixture} from 'sentry-fixture/user';

import {PoliciesFixture} from 'getsentry-test/fixtures/policies';
import {PolicyRevisionsFixture} from 'getsentry-test/fixtures/policyRevisions';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';

import {PolicyDetails} from 'admin/views/policyDetails';

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

  it('can update current version', async () => {
    const updateMock = MockApiClient.addMockResponse({
      url: `/policies/${policy.slug}/revisions/${revisions[0]!.version}/`,
      method: 'PUT',
    });

    render(<PolicyDetails />, {
      initialRouterConfig: {
        location: {
          pathname: `/_admin/policies/${policy.slug}/`,
        },
        route: '/_admin/policies/:policySlug/',
      },
    });

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

  it('shows a saved revision without reloading the page', async () => {
    ConfigStore.set('user', UserFixture({permissions: new Set(['policies.admin'])}));
    const newRevision = {
      ...revisions[0]!,
      version: '3.0.0',
      url: 'https://example.com/terms/3.0.0/',
      file: null,
    };
    let saved = false;
    const listMock = MockApiClient.addMockResponse({
      url: `/policies/${policy.slug}/revisions/`,
      body: () => (saved ? [newRevision, ...revisions] : revisions),
    });
    MockApiClient.addMockResponse({
      url: `/policies/${policy.slug}/revisions/`,
      method: 'POST',
      body: () => {
        saved = true;
        return newRevision;
      },
    });

    render(<PolicyDetails />, {
      initialRouterConfig: {
        location: {pathname: `/_admin/policies/${policy.slug}/`},
        route: '/_admin/policies/:policySlug/',
      },
    });
    renderGlobalModal();

    await screen.findByText('2.0.0');
    await userEvent.click(screen.getByRole('button', {name: 'Policies Actions'}));
    await userEvent.click(screen.getByText('Add Revision'));
    await userEvent.type(
      await screen.findByRole('textbox', {name: 'URL'}),
      newRevision.url
    );
    await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

    expect(await screen.findByText('3.0.0')).toBeInTheDocument();
    expect(listMock).toHaveBeenCalledTimes(2);
  });
});
