import {AuthProvidersFixture} from 'sentry-fixture/authProviders';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {descopeFeatureName} from 'sentry/utils';
import ProviderItem from 'sentry/views/settings/organizationAuth/providerItem';

describe('ProviderItem', function () {
  const provider = AuthProvidersFixture()[0]!;
  const org = OrganizationFixture({
    features: [descopeFeatureName(provider.requiredFeature)],
  });

  it('renders', function () {
    render(<ProviderItem active={false} provider={provider} onConfigure={() => {}} />, {
      organization: org,
    });

    expect(
      screen.getByText('Enable your organization to sign in with Dummy.')
    ).toBeInTheDocument();
  });

  it('calls configure callback', async function () {
    const mock = jest.fn();
    render(<ProviderItem active={false} provider={provider} onConfigure={mock} />, {
      organization: org,
    });

    await userEvent.click(screen.getByRole('button', {name: 'Configure'}));
    expect(mock).toHaveBeenCalledWith('dummy', expect.anything());
  });

  it('renders a disabled Tag when disabled', function () {
    render(<ProviderItem active={false} provider={provider} onConfigure={() => {}} />, {
      organization: OrganizationFixture(),
    });

    expect(screen.getByRole('status')).toHaveTextContent('disabled');
  });
});
