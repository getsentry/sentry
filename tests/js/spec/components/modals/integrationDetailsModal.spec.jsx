import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import IntegrationDetailsModal from 'app/components/modals/integrationDetailsModal';
import HookStore from 'app/stores/hookStore';

describe('IntegrationDetailsModal', function() {
  const integrationAdded = jest.fn();
  const org = TestStubs.Organization();
  const routerContext = TestStubs.routerContext();

  it('renders simple integration', function() {
    const onClose = jest.fn();
    const provider = TestStubs.GitHubIntegrationProvider();

    const wrapper = mountWithTheme(
      <IntegrationDetailsModal
        provider={provider}
        closeModal={onClose}
        organization={org}
        onAddIntegration={integrationAdded}
      />,
      routerContext
    );

    expect(wrapper).toMatchSnapshot();
    wrapper
      .find('Button')
      .first()
      .simulate('click');
    expect(onClose).toHaveBeenCalled();
  });

  it('renders link for non-addable integration', function() {
    const onClose = jest.fn();
    const provider = TestStubs.JiraIntegrationProvider();

    const wrapper = mountWithTheme(
      <IntegrationDetailsModal
        provider={provider}
        closeModal={onClose}
        organization={org}
        onAddIntegration={integrationAdded}
      />,
      routerContext
    );

    expect(wrapper.find('Button[external]').exists()).toBe(true);
  });

  it('disables the button via a hookstore IntegrationFeatures component', function() {
    HookStore.add('integrations:feature-gates', () => ({
      FeatureList: () => null,
      IntegrationFeatures: p =>
        p.children({
          disabled: true,
          disabledReason: 'Integration disabled',
          ungatedFeatures: p.features,
          gatedFeatureGroups: [],
        }),
    }));

    const provider = TestStubs.GitHubIntegrationProvider();

    const wrapper = mountWithTheme(
      <IntegrationDetailsModal
        provider={provider}
        onAddIntegration={integrationAdded}
        organization={org}
        closeModal={() => null}
      />,
      routerContext
    );

    expect(wrapper.find('Button[disabled]').exists()).toBe(true);
    expect(wrapper.find('DisabledNotice').text()).toBe('Integration disabled');
  });
});
