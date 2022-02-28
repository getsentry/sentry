/* global global */
import {mountWithTheme} from 'sentry-test/enzyme';

import AddIntegrationButton from 'sentry/views/organizationIntegrations/addIntegrationButton';

describe('AddIntegrationButton', function () {
  const provider = TestStubs.GitHubIntegrationProvider();

  it('Opens the setup dialog on click', function () {
    const onAdd = jest.fn();

    const focus = jest.fn();
    const open = jest.fn().mockReturnValue({focus});
    global.open = open;

    const wrapper = mountWithTheme(
      <AddIntegrationButton provider={provider} onAddIntegration={onAdd} />
    );

    wrapper.find('Button').simulate('click');
    expect(open.mock.calls).toHaveLength(1);
    expect(focus.mock.calls).toHaveLength(1);
    expect(open.mock.calls[0][2]).toBe(
      'scrollbars=yes,width=100,height=100,top=334,left=462'
    );
  });
});
