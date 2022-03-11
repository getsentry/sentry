import {mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import IssueListSavedSearchSelector from 'sentry/views/issueList/savedSearchSelector';

describe('IssueListSavedSearchSelector', function () {
  const onSelect = jest.fn();
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

  function mountSavedSearchSelector({query} = {}) {
    return mountWithTheme(
      <IssueListSavedSearchSelector
        organization={TestStubs.Organization({access: ['org:write']})}
        savedSearchList={savedSearchList}
        onSavedSearchSelect={onSelect}
        onSavedSearchDelete={jest.fn()}
        query={query ?? 'is:unresolved assigned:lyn@sentry.io'}
      />
    );
  }

  describe('button title', function () {
    it('defaults to custom search', function () {
      mountSavedSearchSelector();
      expect(screen.getByRole('button', {name: 'Custom Search'})).toBeInTheDocument();
    });

    it('uses query to match', function () {
      mountSavedSearchSelector({query: 'is:unresolved assigned:me'});
      expect(screen.getByRole('button', {name: 'Assigned to me'})).toBeInTheDocument();
    });
  });

  describe('selecting an option', function () {
    it('calls onSelect when clicked', function () {
      mountSavedSearchSelector();
      userEvent.click(screen.getByText('Custom Search'));
      userEvent.click(screen.getByText('Assigned to me'));
      expect(onSelect).toHaveBeenCalled();
    });
  });
});
