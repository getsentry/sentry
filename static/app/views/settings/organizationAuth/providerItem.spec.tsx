import {AuthProviders} from 'sentry-fixture/authProviders';
import {Organization} from 'sentry-fixture/organization';
import {RouterContextFixture} from 'sentry-fixture/routerContextFixture';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {descopeFeatureName} from 'sentry/utils';
import ProviderItem from 'sentry/views/settings/organizationAuth/providerItem';

describe('ProviderItem', function () {
  const provider = AuthProviders()[0];
  const org = Organization({
    features: [descopeFeatureName(provider.requiredFeature)],
  });
  const routerContext = RouterContextFixture([{organization: org}]);

  it('renders', function () {
    render(<ProviderItem active={false} provider={provider} onConfigure={() => {}} />, {
      context: routerContext,
    });

    expect(
      screen.getByText('Enable your organization to sign in with Dummy.')
    ).toBeInTheDocument();
  });

  it('calls configure callback', async function () {
    const mock = jest.fn();
    render(<ProviderItem active={false} provider={provider} onConfigure={mock} />, {
      context: routerContext,
    });

    await userEvent.click(screen.getByRole('button', {name: 'Configure'}));
    expect(mock).toHaveBeenCalledWith('dummy', expect.anything());
  });

  it('renders a disabled Tag when disabled', function () {
    const noFeatureRouterContext = RouterContextFixture();
    render(<ProviderItem active={false} provider={provider} onConfigure={() => {}} />, {
      context: noFeatureRouterContext,
    });

    expect(screen.getByRole('status')).toHaveTextContent('disabled');
  });
});
