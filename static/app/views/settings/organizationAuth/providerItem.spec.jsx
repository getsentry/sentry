import {AuthProviders} from 'fixtures/js-stubs/authProviders';
import {Organization} from 'fixtures/js-stubs/organization';
import {routerContext} from 'fixtures/js-stubs/routerContext';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {descopeFeatureName} from 'sentry/utils';
import ProviderItem from 'sentry/views/settings/organizationAuth/providerItem';

describe('ProviderItem', function () {
  const provider = AuthProviders()[0];
  const org = Organization({
    features: [descopeFeatureName(provider.requiredFeature)],
  });
  const routerContext = routerContext([{organization: org}]);

  it('renders', function () {
    render(
      <ProviderItem organization={org} provider={provider} onConfigure={() => {}} />,
      {context: routerContext}
    );

    expect(
      screen.getByText('Enable your organization to sign in with Dummy.')
    ).toBeInTheDocument();
  });

  it('calls configure callback', function () {
    const mock = jest.fn();
    render(<ProviderItem organization={org} provider={provider} onConfigure={mock} />, {
      context: routerContext,
    });

    userEvent.click(screen.getByRole('button', {name: 'Configure'}));
    expect(mock).toHaveBeenCalledWith('dummy', expect.anything());
  });

  it('renders a disabled Tag when disabled', function () {
    const noFeatureRouterContext = routerContext();
    render(
      <ProviderItem organization={org} provider={provider} onConfigure={() => {}} />,
      {context: noFeatureRouterContext}
    );

    expect(screen.getByRole('status')).toHaveTextContent('disabled');
  });
});
