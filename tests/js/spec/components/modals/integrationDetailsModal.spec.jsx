import React from 'react';

import {shallow} from 'enzyme';
import IntegrationDetailsModal from 'app/components/modals/integrationDetailsModal';

describe('IntegrationDetailsModal', function() {
  const integrationAdded = jest.fn();

  it('renders simple integration', function() {
    const onClose = jest.fn();
    const provider = TestStubs.GitHubIntegrationProvider();

    const wrapper = shallow(
      <IntegrationDetailsModal
        provider={provider}
        closeModal={onClose}
        onAddIntegration={integrationAdded}
      />
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

    const wrapper = shallow(
      <IntegrationDetailsModal
        provider={provider}
        closeModal={onClose}
        onAddIntegration={integrationAdded}
      />
    );

    expect(wrapper.find('Button[external]').exists()).toBe(true);
  });
});
