import React from 'react';
import {mount} from 'enzyme';

import SavedSearchSelector from 'app/views/stream/savedSearchSelector';

describe('SavedSearchSelector', function() {
  let wrapper;
  let props;

  let orgId;
  let projectId;
  let savedSearchList;
  let onCreate = jest.fn();
  let onSelect = jest.fn();

  beforeEach(function() {
    projectId = 'test-project';
    orgId = 'test-org';
    savedSearchList = [
      {
        id: '789',
        query: 'is:unresolved',
        name: 'Unresolved',
        projectId,
      },
      {
        id: '122',
        query: 'is:unresolved assigned:me',
        name: 'Assigned to me',
        projectId,
      },
    ];

    let access = new Set(['project:write']);

    props = {
      projectId,
      orgId,
      savedSearchList,
      access,
      onSavedSearchCreate: onCreate,
      onSavedSearchSelect: onSelect,
      query: '',
    };
  });

  describe('getTitle', function() {
    beforeEach(function() {
      wrapper = mount(<SavedSearchSelector {...props} />, TestStubs.routerContext());
    });

    it('defaults to custom search', function() {
      let instance = wrapper.find('SavedSearchSelector').instance();

      expect(instance.getTitle()).toEqual('Custom Search');
    });

    it('uses searchId to match', function() {
      wrapper.setProps({searchId: '789'});
      let instance = wrapper.find('SavedSearchSelector').instance();

      expect(instance.getTitle()).toEqual('Unresolved');
    });

    it('uses query to match', function() {
      wrapper.setProps({query: 'is:unresolved assigned:me'});
      let instance = wrapper.find('SavedSearchSelector').instance();

      expect(instance.getTitle()).toEqual('Assigned to me');
    });
  });

  describe('selecting an option', function() {
    beforeEach(function() {
      wrapper = mount(<SavedSearchSelector {...props} />, TestStubs.routerContext());
    });

    it('calls onSelect when clicked', async function() {
      wrapper.find('DropdownLink').simulate('click');
      await wrapper.update();

      let item = wrapper.find('StyledMenuItem a').first();
      expect(item).toHaveLength(1);

      item.simulate('click');
      expect(onSelect).toHaveBeenCalled();
    });
  });

  describe('render with a projectId', function() {
    beforeEach(function() {
      wrapper = mount(<SavedSearchSelector {...props} />, TestStubs.routerContext());
    });

    it('renders enabled manage and create buttons', function() {
      wrapper.find('DropdownLink').simulate('click');

      let buttons = wrapper.find('Button');
      expect(buttons).toHaveLength(2);

      let createButton = buttons.first();
      expect(createButton.text()).toEqual('Save Current Search');
      expect(createButton.props().disabled).toBeFalsy();

      let manageButton = buttons.last();
      expect(manageButton.text()).toEqual('Manage');
      expect(manageButton.props().disabled).toBeFalsy();
    });
  });

  describe('render without a projectId', function() {
    beforeEach(function() {
      props.projectId = null;
      wrapper = mount(<SavedSearchSelector {...props} />, TestStubs.routerContext());
    });

    it('renders disabled manage and create buttons', function() {
      wrapper.find('DropdownLink').simulate('click');

      let buttons = wrapper.find('Button');
      expect(buttons).toHaveLength(2);

      let createButton = buttons.first();
      expect(createButton.props().disabled).toBeTruthy();

      let manageButton = buttons.last();
      expect(manageButton.props().disabled).toBeTruthy();
    });
  });
});
