import React from 'react';

import {mount} from 'enzyme';
import {openDocsSearchModal} from 'app/actionCreators/modal';
import App from 'app/views/app';

describe('Docs Search Modal', function() {
  beforeEach(function() {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
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
      url: '/internal/health/',
      body: {
        problems: [],
      },
    });
    MockApiClient.addMockResponse({
      url: '/assistant/',
      body: [],
    });
  });

  it('can open docs search modal and search', async function() {
    let wrapper = mount(
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

    openDocsSearchModal();
    await tick();
    await tick();
    wrapper.update();

    // Should have Modal + input
    expect(wrapper.find('ModalDialog')).toHaveLength(1);

    let stub = sinon.stub($, 'get', (url, cb) => {
      if (url.includes('rigidsearch')) {
        cb({
          items: [
            {path: 'clients/node#sourcemaps', title: 'Source Maps'},
            {path: 'clients/java/modules/logback#usage', title: 'Usage'},
          ],
        });
      } else {
        cb({
          results: [
            {html_url: 'https://help.sentry.io/100', title: '100'},
            {html_url: 'https://help.sentry.io/200', title: '200'},
          ],
        });
      }
    });

    wrapper.find('ModalDialog input').simulate('change', {target: {value: 'dummy'}});

    await tick();
    wrapper.update();

    expect(wrapper.find('SearchResultWrapper')).toHaveLength(4);
    expect(wrapper.find('SearchSources DropdownBox')).toMatchSnapshot();

    stub.restore();
  });
});
