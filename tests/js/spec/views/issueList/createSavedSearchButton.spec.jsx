import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import CreateSavedSearchButton from 'app/views/issueList/createSavedSearchButton';

describe('CreateSavedSearchButton', function () {
  let wrapper, organization, createMock;

  beforeEach(function () {
    organization = TestStubs.Organization({
      access: ['org:write'],
    });
    wrapper = mountWithTheme(
      <CreateSavedSearchButton
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
    it('clicking save search opens modal', function () {
      expect(wrapper.find('ModalDialog')).toHaveLength(0);
      wrapper.find('button[data-test-id="save-current-search"]').simulate('click');
      expect(wrapper.find('ModalDialog')).toHaveLength(1);
    });

    it('saves a search when query is not changed', async function () {
      wrapper.find('button[data-test-id="save-current-search"]').simulate('click');
      wrapper.find('#id-name').simulate('change', {target: {value: 'new search name'}});
      wrapper.find('ModalDialog').find('Button[priority="primary"]').simulate('submit');

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
      wrapper.find('button[data-test-id="save-current-search"]').simulate('click');
      wrapper.find('#id-name').simulate('change', {target: {value: 'new search name'}});
      wrapper.find('#id-query').simulate('change', {target: {value: 'is:resolved'}});
      wrapper.find('ModalDialog').find('Button[priority="primary"]').simulate('submit');

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

    it('shows button by default', function () {
      const orgWithoutFeature = TestStubs.Organization({
        access: ['org:write'],
      });
      wrapper.setProps({organization: orgWithoutFeature});

      const button = wrapper.find(
        'button[aria-label="Add to organization saved searches"]'
      );
      expect(button).toHaveLength(1);
    });

    it('hides button if no access', function () {
      const orgWithoutAccess = TestStubs.Organization({
        access: ['org:read'],
      });
      wrapper.setProps({organization: orgWithoutAccess});

      const button = wrapper.find(
        'button[aria-label="Add to organization saved searches"]'
      );
      expect(button).toHaveLength(0);
    });
  });
});
