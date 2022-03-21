/* global global */
import {mountWithTheme} from 'sentry-test/enzyme';

import AddIntegration from 'sentry/views/organizationIntegrations/addIntegration';

describe('AddIntegration', function () {
  const provider = TestStubs.GitHubIntegrationProvider();
  const integration = TestStubs.GitHubIntegration();

  it('Adds an integration on dialog completion', function () {
    const onAdd = jest.fn();

    const focus = jest.fn();
    const open = jest.fn().mockReturnValue({focus});
    global.open = open;

    const wrapper = mountWithTheme(
      <AddIntegration provider={provider} onInstall={onAdd}>
        {onClick => (
          <a href="#" onClick={onClick}>
            Click
          </a>
        )}
      </AddIntegration>
    );

    const newIntegration = {
      source: null,
      origin: 'http://localhost',
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

    wrapper.instance().didReceiveMessage(newIntegration);
    expect(onAdd).toHaveBeenCalledWith(newIntegration.data.data);
  });
});
