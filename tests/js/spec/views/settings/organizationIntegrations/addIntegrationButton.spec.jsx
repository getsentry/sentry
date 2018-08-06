/*global global*/
import React from 'react';

import {mount} from 'enzyme';
import AddIntegrationButton from 'app/views/organizationIntegrations/addIntegrationButton';

describe('AddIntegrationButton', function() {
  const provider = TestStubs.GitHubIntegrationProvider();
  const integration = TestStubs.GitHubIntegration();

  const routerContext = TestStubs.routerContext();

  it('Opens the setup dialog on click', function() {
    const onAdd = jest.fn();

    const wrapper = mount(
      <AddIntegrationButton provider={provider} onAddIntegration={onAdd} />,
      routerContext
    );
    const focus = jest.fn();
    const open = jest.fn().mockReturnValue({focus});
    global.open = open;

    wrapper.find('Button').simulate('click');
    expect(open.mock.calls).toHaveLength(1);
    expect(focus.mock.calls).toHaveLength(1);
    expect(open.mock.calls[0][2]).toBe(
      'scrollbars=yes,width=100,height=100,top=334,left=462'
    );
  });

  it('Adds an integration on dialog completion', function() {
    const onAdd = jest.fn();

    const wrapper = mount(
      <AddIntegrationButton provider={provider} onAddIntegration={onAdd} />,
      routerContext
    );

    const newIntegration = {
      source: null,
      origin: 'null',
      data: {
        success: true,
        data: Object.assign({}, integration, {
          id: '2',
          domain_name: 'new-integration.github.com',
          icon: 'http://example.com/new-integration-icon.png',
          name: 'New Integration',
        }),
      },
    };

    wrapper.instance().receiveMessage(newIntegration);
    expect(onAdd).toBeCalledWith(newIntegration.data.data);
  });
});
