import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {mountGlobalModal} from 'sentry-test/modal';

import IssueListSavedSearchMenu from 'app/views/issueList/savedSearchMenu';

describe('IssueListSavedSearchMenu', () => {
  let wrapper;
  let organization;
  const savedSearchList = [
    {
      id: '789',
      query: 'is:unresolved',
      name: 'Unresolved',
      isPinned: false,
      isGlobal: true,
    },
    {
      id: '122',
      query: 'is:unresolved assigned:me',
      name: 'Assigned to me',
      isPinned: false,
      isGlobal: false,
    },
  ];
  const onSelect = jest.fn();
  const onDelete = jest.fn();
  beforeEach(() => {
    organization = TestStubs.Organization({access: ['org:write']});
    wrapper = mountWithTheme(
      <IssueListSavedSearchMenu
        organization={organization}
        savedSearchList={savedSearchList}
        onSavedSearchSelect={onSelect}
        onSavedSearchDelete={onDelete}
        query="is:unresolved assigned:lyn@sentry.io"
      />,
      TestStubs.routerContext()
    );
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.resetAllMocks();
  });

  describe('removing a saved search', () => {
    it('shows a delete button with access', () => {
      // Second item should have a delete button as it is not a global search
      const button = wrapper.find('MenuItem').at(1).find('button[aria-label="delete"]');
      expect(button).toHaveLength(1);
    });

    it('does not show a delete button without access', () => {
      organization.access = [];
      wrapper.setProps({organization});

      const button = wrapper.find('MenuItem').at(1).find('button[aria-label="delete"]');
      expect(button).toHaveLength(0);
    });

    it('does not show a delete button for global search', () => {
      // First item should not have a delete button as it is a global search
      const button = wrapper.find('MenuItem').first().find('button[aria-label="delete"]');
      expect(button).toHaveLength(0);
    });

    it('sends a request when delete button is clicked', async () => {
      // Second item should have a delete button as it is not a global search
      const button = wrapper.find('MenuItem').at(1).find('button[aria-label="delete"]');
      button.simulate('click');
      await wrapper.update();

      const modal = await mountGlobalModal();
      modal.find('Modal Button[priority="primary"] button').simulate('click');
      expect(onDelete).toHaveBeenCalledWith(savedSearchList[1]);
    });
  });
});
