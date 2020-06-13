import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {openCommandPalette} from 'app/actionCreators/modal';
import App from 'app/views/app';
import FormSearchStore from 'app/stores/formSearchStore';
import {navigateTo} from 'app/actionCreators/navigation';

jest.mock('jquery');
jest.mock('app/actionCreators/formSearch');
jest.mock('app/actionCreators/navigation');

describe('Command Palette Modal', function() {
  let orgsMock;

  beforeEach(function() {
    FormSearchStore.onLoadSearchMap([]);

    MockApiClient.clearMockResponses();

    orgsMock = MockApiClient.addMockResponse({
      url: '/organizations/',
      body: [TestStubs.Organization({slug: 'billy-org', name: 'billy org'})],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      query: 'foo',
      body: [TestStubs.Project({slug: 'foo-project'})],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/teams/',
      query: 'foo',
      body: [TestStubs.Team({slug: 'foo-team'})],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      query: 'foo',
      body: TestStubs.Members(),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/plugins/?plugins=_all',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/config/integrations/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/plugins/configs/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/sentry-apps/?status=published',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/internal/health/',
      body: {
        problems: [],
      },
    });
    MockApiClient.addMockResponse({
      url: '/assistant/?v2',
      body: [],
    });
  });

  it('can open command palette modal and search', async function() {
    const wrapper = mountWithTheme(
      <App params={{orgId: 'org-slug'}}>{<div>placeholder content</div>}</App>,
      TestStubs.routerContext([
        {
          router: TestStubs.router({
            params: {orgId: 'org-slug'},
          }),
        },
      ])
    );

    // No Modal
    expect(wrapper.find('ModalDialog')).toHaveLength(0);

    openCommandPalette({params: {orgId: 'org-slug'}});
    await tick();
    await tick();
    wrapper.update();

    // Should have Modal + input
    expect(wrapper.find('ModalDialog')).toHaveLength(1);
    wrapper.find('ModalDialog input').simulate('change', {target: {value: 'bil'}});

    await tick();
    wrapper.update();

    expect(orgsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        // This nested 'query' is correct
        query: {query: 'bil'},
      })
    );

    expect(
      wrapper
        .find('SearchResult [data-test-id="badge-display-name"]')
        .first()
        .text()
    ).toBe('billy-org Dashboard');

    expect(
      wrapper
        .find('ModalDialog SearchResultWrapper')
        .first()
        .prop('highlighted')
    ).toBe(true);

    expect(
      wrapper
        .find('ModalDialog SearchResultWrapper')
        .at(1)
        .prop('highlighted')
    ).toBe(false);

    wrapper
      .find('SearchResult [data-test-id="badge-display-name"]')
      .first()
      .simulate('click');

    expect(navigateTo).toHaveBeenCalledWith('/billy-org/', expect.anything());
  });
});
