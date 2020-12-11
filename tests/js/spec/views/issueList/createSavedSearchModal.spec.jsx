import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import CreateSavedSearchModal from 'app/views/issueList/createSavedSearchModal';

describe('CreateSavedSearchModal', function () {
  let wrapper, organization, createMock;

  beforeEach(function () {
    organization = TestStubs.Organization({
      access: ['org:write'],
    });
    wrapper = mountWithTheme(
      <CreateSavedSearchModal
        Header={p => p.children}
        Body={p => p.children}
        Footer={p => p.children}
        organization={organization}
        query="is:unresolved assigned:lyn@sentry.io"
      />,
      TestStubs.routerContext()
    );

    createMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/searches/',
      method: 'POST',
      body: {id: '1', name: 'test', query: 'is:unresolved assigned:lyn@sentry.io'},
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  describe('saves a search', function () {
    it('saves a search when query is not changed', async function () {
      wrapper.find('#id-name').simulate('change', {target: {value: 'new search name'}});
      wrapper.find('Footer').find('Button[priority="primary"]').simulate('submit');

      await tick();
      expect(createMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            name: 'new search name',
            query: 'is:unresolved assigned:lyn@sentry.io',
            type: 0,
          },
        })
      );
    });

    it('saves a search when query is changed', async function () {
      wrapper.find('#id-name').simulate('change', {target: {value: 'new search name'}});
      wrapper.find('#id-query').simulate('change', {target: {value: 'is:resolved'}});
      wrapper.find('Footer').find('Button[priority="primary"]').simulate('submit');

      await tick();
      expect(createMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            name: 'new search name',
            query: 'is:resolved',
            type: 0,
          },
        })
      );
    });
  });
});
