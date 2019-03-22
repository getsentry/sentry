import React from 'react';
import {mount} from 'enzyme';

import OrganizationSavedSearchSelector from 'app/views/stream/organizationSavedSearchSelector';

describe('OrganizationSavedSearchSelector', function() {
  let wrapper, onSelect;
  beforeEach(function() {
    onSelect = jest.fn();
    const savedSearchList = [
      {
        id: '789',
        query: 'is:unresolved',
        name: 'Unresolved',
        isPinned: false,
      },
      {
        id: '122',
        query: 'is:unresolved assigned:me',
        name: 'Assigned to me',
        isPinned: false,
      },
    ];

    wrapper = mount(
      <OrganizationSavedSearchSelector
        savedSearchList={savedSearchList}
        onSavedSearchSelect={onSelect}
      />
    );
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
});
