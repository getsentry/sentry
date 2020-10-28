/*global global*/
import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import AddIntegrationButton from 'app/views/organizationIntegrations/addIntegrationButton';

describe('AddIntegrationButton', function () {
  const provider = TestStubs.GitHubIntegrationProvider();

  const routerContext = TestStubs.routerContext();

  it('Opens the setup dialog on click', function () {
    const onAdd = jest.fn();

    const focus = jest.fn();
    const open = jest.fn().mockReturnValue({focus});
    global.open = open;

    const wrapper = mountWithTheme(
      <AddIntegrationButton provider={provider} onAddIntegration={onAdd} />,
      routerContext
    );

    wrapper.find('Button').simulate('click');
    expect(open.mock.calls).toHaveLength(1);
    expect(focus.mock.calls).toHaveLength(1);
    expect(open.mock.calls[0][2]).toBe(
      'scrollbars=yes,width=100,height=100,top=334,left=462'
    );
  });
});
