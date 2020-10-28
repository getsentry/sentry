import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import IssueListSavedSearchSelector from 'app/views/issueList/savedSearchSelector';

describe('IssueListSavedSearchSelector', function () {
  let wrapper, onCreate, onSelect, onDelete, organization, savedSearchList;
  beforeEach(function () {
    organization = TestStubs.Organization({access: ['org:write']});
    onSelect = jest.fn();
    onDelete = jest.fn();
    onCreate = jest.fn();
    savedSearchList = [
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
    wrapper = mountWithTheme(
      <IssueListSavedSearchSelector
        organization={organization}
        savedSearchList={savedSearchList}
        onSavedSearchCreate={onCreate}
        onSavedSearchSelect={onSelect}
        onSavedSearchDelete={onDelete}
        query="is:unresolved assigned:lyn@sentry.io"
      />,
      TestStubs.routerContext()
    );
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  describe('getTitle()', function () {
    it('defaults to custom search', function () {
      expect(wrapper.instance().getTitle()).toEqual('Custom Search');
    });

    it('uses searchId to match', function () {
      wrapper.setProps({searchId: '789'});
      expect(wrapper.instance().getTitle()).toEqual('Unresolved');
    });

    it('uses query to match', function () {
      wrapper.setProps({query: 'is:unresolved assigned:me'});
      expect(wrapper.instance().getTitle()).toEqual('Assigned to me');
    });
  });

  describe('selecting an option', function () {
    it('calls onSelect when clicked', async function () {
      wrapper.find('DropdownButton').simulate('click');
      await wrapper.update();

      const item = wrapper.find('MenuItem a').first();
      expect(item).toHaveLength(1);

      item.simulate('click');
      expect(onSelect).toHaveBeenCalled();
    });
  });

  describe('removing a saved search', function () {
    it('shows a delete button with access', async function () {
      wrapper.find('DropdownButton').simulate('click');
      await wrapper.update();

      // Second item should have a delete button as it is not a global search
      const button = wrapper.find('MenuItem').at(1).find('button[aria-label="delete"]');
      expect(button).toHaveLength(1);
    });

    it('does not show a delete button without access', async function () {
      organization.access = [];
      wrapper.setProps({organization});

      wrapper.find('DropdownButton').simulate('click');
      await wrapper.update();

      const button = wrapper.find('MenuItem').at(1).find('button[aria-label="delete"]');
      expect(button).toHaveLength(0);
    });

    it('does not show a delete button for global search', async function () {
      wrapper.find('DropdownButton').simulate('click');
      await wrapper.update();

      // First item should not have a delete button as it is a global search
      const button = wrapper.find('MenuItem').first().find('button[aria-label="delete"]');
      expect(button).toHaveLength(0);
    });

    it('sends a request when delete button is clicked', async function () {
      wrapper.find('DropdownButton').simulate('click');
      await wrapper.update();

      // Second item should have a delete button as it is not a global search
      const button = wrapper.find('MenuItem').at(1).find('button[aria-label="delete"]');
      button.simulate('click');
      await wrapper.update();

      wrapper.find('Modal Button[priority="primary"] button').simulate('click');
      expect(onDelete).toHaveBeenCalledWith(savedSearchList[1]);
    });
  });
});
