import React from 'react';
import {mount} from 'enzyme';

import OrganizationSavedSearchSelector from 'app/views/stream/organizationSavedSearchSelector';

describe('OrganizationSavedSearchSelector', function() {
  let wrapper, onCreate, onSelect, onDelete, organization, savedSearchList, createMock;
  beforeEach(function() {
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
    wrapper = mount(
      <OrganizationSavedSearchSelector
        organization={organization}
        savedSearchList={savedSearchList}
        onSavedSearchCreate={onCreate}
        onSavedSearchSelect={onSelect}
        onSavedSearchDelete={onDelete}
        query={'is:unresolved assigned:lyn@sentry.io'}
      />,
      TestStubs.routerContext()
    );

    createMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/searches/',
      method: 'POST',
      body: {id: '1', name: 'test', query: 'is:unresolved assigned:lyn@sentry.io'},
    });
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  describe('getTitle()', function() {
    it('defaults to custom search', function() {
      expect(wrapper.instance().getTitle()).toEqual('Custom Search');
    });

    it('uses searchId to match', function() {
      wrapper.setProps({searchId: '789'});
      expect(wrapper.instance().getTitle()).toEqual('Unresolved');
    });

    it('uses query to match', function() {
      wrapper.setProps({query: 'is:unresolved assigned:me'});
      expect(wrapper.instance().getTitle()).toEqual('Assigned to me');
    });
  });

  describe('selecting an option', function() {
    it('calls onSelect when clicked', async function() {
      wrapper.find('DropdownLink').simulate('click');
      await wrapper.update();

      const item = wrapper.find('StyledMenuItem a').first();
      expect(item).toHaveLength(1);

      item.simulate('click');
      expect(onSelect).toHaveBeenCalled();
    });
  });

  describe('removing a saved search', function() {
    it('shows a delete button with access', async function() {
      wrapper.find('DropdownLink').simulate('click');
      await wrapper.update();

      // Second item should have a delete button as it is not a global search
      const button = wrapper
        .find('StyledMenuItem')
        .at(1)
        .find('Button[icon="icon-trash"]');
      expect(button).toHaveLength(1);
    });

    it('does not show a delete button without access', async function() {
      organization.access = [];
      wrapper.setProps({organization});

      wrapper.find('DropdownLink').simulate('click');
      await wrapper.update();

      const button = wrapper
        .find('StyledMenuItem')
        .at(1)
        .find('Button[icon="icon-trash"]');
      expect(button).toHaveLength(0);
    });

    it('does not show a delete button for global search', async function() {
      wrapper.find('DropdownLink').simulate('click');
      await wrapper.update();

      // First item should not have a delete button as it is a global search
      const button = wrapper
        .find('StyledMenuItem')
        .first()
        .find('Button[icon="icon-trash"]');
      expect(button).toHaveLength(0);
    });

    it('sends a request when delete button is clicked', async function() {
      wrapper.find('DropdownLink').simulate('click');
      await wrapper.update();

      // Second item should have a delete button as it is not a global search
      const button = wrapper
        .find('StyledMenuItem')
        .at(1)
        .find('Button[icon="icon-trash"]');
      button.simulate('click');
      await wrapper.update();

      wrapper.find('Modal Button[priority="primary"]').simulate('click');
      expect(onDelete).toHaveBeenCalledWith(savedSearchList[1]);
    });
  });

  describe('saves a search', function() {
    it('clicking save search opens modal', function() {
      wrapper.find('DropdownLink').simulate('click');
      expect(wrapper.find('ModalDialog')).toHaveLength(0);
      wrapper.find('Button[data-test-id="save-current-search"]').simulate('click');
      expect(wrapper.find('ModalDialog')).toHaveLength(1);
    });

    it('saves a search', async function() {
      wrapper.find('DropdownLink').simulate('click');
      wrapper.find('Button[data-test-id="save-current-search"]').simulate('click');
      wrapper.find('#id-name').simulate('change', {target: {value: 'test'}});
      wrapper
        .find('ModalDialog')
        .find('Button[priority="primary"]')
        .simulate('submit');

      expect(createMock).toHaveBeenCalled();
      expect(onCreate).toHaveBeenCalled();
    });

    it('hides save search button if no access', function() {
      const orgWithoutAccess = TestStubs.Organization({access: ['org:read']});

      wrapper.setProps({organization: orgWithoutAccess});

      const button = wrapper.find('button');

      expect(button).toHaveLength(0);
    });
  });
});
