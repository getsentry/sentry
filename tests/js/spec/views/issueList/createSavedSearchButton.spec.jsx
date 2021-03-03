import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {openModal} from 'app/actionCreators/modal';
import CreateSavedSearchButton from 'app/views/issueList/createSavedSearchButton';

jest.mock('app/actionCreators/modal');

describe('CreateSavedSearchButton', function () {
  let wrapper, organization;

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
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  describe('saves a search', function () {
    it('clicking save search opens modal', function () {
      wrapper.find('button[data-test-id="save-current-search"]').simulate('click');

      expect(openModal).toHaveBeenCalled();
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
