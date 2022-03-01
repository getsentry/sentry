import {mountWithTheme} from 'sentry-test/enzyme';

import IssueListSavedSearchSelector from 'sentry/views/issueList/savedSearchSelector';

describe('IssueListSavedSearchSelector', function () {
  let wrapper, onSelect, onDelete, organization, savedSearchList;
  beforeEach(function () {
    organization = TestStubs.Organization({access: ['org:write']});
    onSelect = jest.fn();
    onDelete = jest.fn();
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
        onSavedSearchSelect={onSelect}
        onSavedSearchDelete={onDelete}
        query="is:unresolved assigned:lyn@sentry.io"
      />
    );
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  describe('button title', function () {
    it('defaults to custom search', function () {
      expect(wrapper.find('ButtonTitle').text()).toBe('Custom Search');
    });

    it('uses query to match', function () {
      wrapper.setProps({query: 'is:unresolved assigned:me'});
      wrapper.update();

      expect(wrapper.find('ButtonTitle').text()).toBe('Assigned to me');
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
});
