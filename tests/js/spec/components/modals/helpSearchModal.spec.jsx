import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {openHelpSearchModal} from 'app/actionCreators/modal';
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
      url: '/organizations/org-slug/plugins/?plugins=_all',
      query: 'foo',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/config/integrations/',
      query: 'foo',
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

  it('can open help search modal and complete a search', async function() {
    jest.mock('algoliasearch', () => {
      const search = jest.fn(() => {
        const docHits = [
          {
            url: '/doc_result',
            _highlightResult: {
              title: {value: 'Doc result 1'},
            },
            _snippetResult: {
              content: {value: 'Doc result 1 description'},
            },
          },
        ];
        const faqHits = [
          {
            url: '/faq_result',
            _highlightResult: {
              title: {value: 'FAQ result 1'},
            },
            _snippetResult: {
              body_safe: {value: 'FAQ result 1 description'},
            },
          },
        ];

        return Promise.resolve({results: [{hits: docHits}, {hits: faqHits}]});
      });

      return () => ({search});
    });

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

    openHelpSearchModal();
    await tick();
    await tick();
    wrapper.update();

    // Should have Modal + input
    expect(wrapper.find('ModalDialog')).toHaveLength(1);

    wrapper.find('ModalDialog input').simulate('change', {target: {value: 'dummy'}});

    await tick();
    wrapper.update();

    expect(wrapper.find('SearchResultWrapper')).toHaveLength(2);
    expect(wrapper.find('SearchSources DropdownBox')).toSnapshot();
    expect(wrapper.find('SearchSources DropdownBox')).toMatchSnapshot();
  });
});
