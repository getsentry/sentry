import {AuthProvidersFixture} from 'sentry-fixture/authProviders';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {descopeFeatureName} from 'sentry/utils';
import {ProviderItem} from 'sentry/views/settings/organizationAuth/providerItem';

describe('ProviderItem', () => {
  const provider = AuthProvidersFixture()[0]!;
  const org = OrganizationFixture({
    features: [descopeFeatureName(provider.requiredFeature)],
  });

  it('renders', () => {
    render(<ProviderItem active={false} provider={provider} />, {
      organization: org,
    });

    expect(
      screen.getByText('Enable your organization to sign in with Dummy.')
    ).toBeInTheDocument();
  });

  it('renders a disabled Tag when disabled', () => {
    render(<ProviderItem active={false} provider={provider} />, {
      organization: OrganizationFixture(),
    });

    expect(screen.getByRole('status')).toHaveTextContent('disabled');
  });
});
