import {DeprecatedApiKeyFixture} from 'sentry-fixture/deprecatedApiKey';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import OrganizationApiKeysList from 'sentry/views/settings/organizationApiKeys/organizationApiKeysList';

describe('OrganizationApiKeysList', function () {
  it('opens a modal when trying to delete a key', async function () {
    render(
      <OrganizationApiKeysList
        organization={OrganizationFixture()}
        keys={[DeprecatedApiKeyFixture()]}
        busy={false}
        loading={false}
        onRemove={jest.fn()}
        onAddApiKey={jest.fn()}
      />
    );
    renderGlobalModal();

    // Click remove button
    await userEvent.click(await screen.findByTitle('Remove API Key?'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
