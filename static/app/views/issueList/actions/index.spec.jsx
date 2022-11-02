import {Fragment} from 'react';

import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
  within,
} from 'sentry-test/reactTestingLibrary';

import GlobalModal from 'sentry/components/globalModal';
import GroupStore from 'sentry/stores/groupStore';
import SelectedGroupStore from 'sentry/stores/selectedGroupStore';
import {IssueCategory} from 'sentry/types';
import {IssueListActions} from 'sentry/views/issueList/actions';

const organization = TestStubs.Organization();

const defaultProps = {
  allResultsVisible: false,
  query: '',
  queryCount: 15,
  projectId: 'project-slug',
  selection: {
    projects: [1],
    environments: [],
    datetime: {start: null, end: null, period: null, utc: true},
  },
  groupIds: ['1', '2', '3'],
  onRealtimeChange: jest.fn(),
  onSelectStatsPeriod: jest.fn(),
  realtimeActive: false,
  statsPeriod: '24h',
  onDelete: jest.fn(),
};

function WrappedComponent(props) {
  return (
    <Fragment>
      <GlobalModal />
      <IssueListActions {...defaultProps} {...props} />
    </Fragment>
  );
}

describe('IssueListActions', function () {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    GroupStore.reset();
    SelectedGroupStore.reset();
    SelectedGroupStore.add(['1', '2', '3']);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [TestStubs.Project({id: 1})],
    });
  });

  describe('Bulk', function () {
    describe('Total results greater than bulk limit', function () {
      it('after checking "Select all" checkbox, displays bulk select message', function () {
        render(<WrappedComponent queryCount={1500} />);

        userEvent.click(screen.getByRole('checkbox'));

        expect(screen.getByTestId('issue-list-select-all-notice')).toSnapshot();
      });

      it('can bulk select', function () {
        render(<WrappedComponent queryCount={1500} />);

        userEvent.click(screen.getByRole('checkbox'));
        userEvent.click(screen.getByTestId('issue-list-select-all-notice-link'));

        expect(screen.getByTestId('issue-list-select-all-notice')).toSnapshot();
      });

      it('bulk resolves', async function () {
        const apiMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/issues/',
          method: 'PUT',
        });

        render(<WrappedComponent queryCount={1500} />);
        userEvent.click(screen.getByRole('checkbox'));

        userEvent.click(screen.getByTestId('issue-list-select-all-notice-link'));

        userEvent.click(screen.getByRole('button', {name: 'Resolve'}));

        await screen.findByRole('dialog');

        userEvent.click(screen.getByRole('button', {name: 'Bulk resolve issues'}));

        expect(apiMock).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: {
              project: [1],
            },
            data: {status: 'resolved', statusDetails: {}},
          })
        );
      });
    });

    describe('Total results less than bulk limit', function () {
      it('after checking "Select all" checkbox, displays bulk select message', function () {
        render(<WrappedComponent queryCount={15} />);

        userEvent.click(screen.getByRole('checkbox'));

        expect(screen.getByTestId('issue-list-select-all-notice')).toSnapshot();
      });

      it('can bulk select', function () {
        render(<WrappedComponent queryCount={15} />);

        userEvent.click(screen.getByRole('checkbox'));

        userEvent.click(screen.getByTestId('issue-list-select-all-notice-link'));

        expect(screen.getByTestId('issue-list-select-all-notice')).toSnapshot();
      });

      it('bulk resolves', function () {
        const apiMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/issues/',
          method: 'PUT',
        });

        render(<WrappedComponent queryCount={15} />);

        userEvent.click(screen.getByRole('checkbox'));

        userEvent.click(screen.getByTestId('issue-list-select-all-notice-link'));

        userEvent.click(screen.getByRole('button', {name: 'Resolve'}));

        const modal = screen.getByRole('dialog');

        expect(modal).toSnapshot();

        userEvent.click(within(modal).getByRole('button', {name: 'Bulk resolve issues'}));

        expect(apiMock).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: {
              project: [1],
            },
            data: {status: 'resolved', statusDetails: {}},
          })
        );
      });
    });

    describe('Selected on page', function () {
      it('resolves selected items', function () {
        const apiMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/issues/',
          method: 'PUT',
        });

        jest.spyOn(SelectedGroupStore, 'getSelectedIds').mockReturnValue(new Set(['1']));

        render(<WrappedComponent groupIds={['1', '2', '3', '6', '9']} />);

        const resolveButton = screen.getByRole('button', {name: 'Resolve'});
        expect(resolveButton).toBeEnabled();
        userEvent.click(resolveButton);

        expect(apiMock).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: {
              id: ['1'],
              project: [1],
            },
            data: {status: 'resolved', statusDetails: {}},
          })
        );
      });

      it('can ignore selected items (custom)', async function () {
        const apiMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/issues/',
          method: 'PUT',
        });
        jest.spyOn(SelectedGroupStore, 'getSelectedIds').mockReturnValue(new Set(['1']));

        render(<WrappedComponent {...defaultProps} />);

        userEvent.click(screen.getByRole('button', {name: 'Ignore options'}));
        fireEvent.click(screen.getByText(/Until this affects an additional/));
        await screen.findByTestId('until-affect-custom');
        userEvent.click(screen.getByTestId('until-affect-custom'));

        const modal = screen.getByRole('dialog');

        userEvent.clear(within(modal).getByRole('spinbutton', {name: 'Number of users'}));
        userEvent.type(
          within(modal).getByRole('spinbutton', {name: 'Number of users'}),
          '300'
        );

        userEvent.click(within(modal).getByRole('textbox'));
        userEvent.click(within(modal).getByText('per week'));

        userEvent.click(within(modal).getByRole('button', {name: 'Ignore'}));

        expect(apiMock).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: {
              id: ['1'],
              project: [1],
            },
            data: {
              status: 'ignored',
              statusDetails: {
                ignoreUserCount: 300,
                ignoreUserWindow: 10080,
              },
            },
          })
        );
      });
    });
  });

  it('can resolve but not merge issues from different projects', function () {
    jest
      .spyOn(SelectedGroupStore, 'getSelectedIds')
      .mockImplementation(() => new Set(['1', '2', '3']));
    jest.spyOn(GroupStore, 'get').mockImplementation(id => {
      switch (id) {
        case '1':
          return TestStubs.Group({project: TestStubs.Project({slug: 'project-1'})});
        default:
          return TestStubs.Group({project: TestStubs.Project({slug: 'project-2'})});
      }
    });

    render(<WrappedComponent />);

    // Can resolve but not merge issues from multiple projects
    expect(screen.getByRole('button', {name: 'Resolve'})).toBeEnabled();
    expect(screen.getByRole('button', {name: 'Merge Selected Issues'})).toBeDisabled();
  });

  describe('mark reviewed', function () {
    it('acknowledges group', function () {
      const mockOnMarkReviewed = jest.fn();

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        method: 'PUT',
      });

      jest
        .spyOn(SelectedGroupStore, 'getSelectedIds')
        .mockImplementation(() => new Set(['1', '2', '3']));
      jest.spyOn(GroupStore, 'get').mockImplementation(id => {
        return TestStubs.Group({
          id,
          inbox: {
            date_added: '2020-11-24T13:17:42.248751Z',
            reason: 0,
            reason_details: null,
          },
        });
      });
      render(<WrappedComponent onMarkReviewed={mockOnMarkReviewed} />);

      const reviewButton = screen.getByRole('button', {name: 'Mark Reviewed'});
      expect(reviewButton).toBeEnabled();
      userEvent.click(reviewButton);

      expect(mockOnMarkReviewed).toHaveBeenCalledWith(['1', '2', '3']);
    });

    it('mark reviewed disabled for group that is already reviewed', function () {
      SelectedGroupStore.add(['1']);
      SelectedGroupStore.toggleSelectAll();
      GroupStore.loadInitialData([TestStubs.Group({id: '1', inbox: null})]);

      render(<WrappedComponent {...defaultProps} />);

      expect(screen.getByRole('button', {name: 'Mark Reviewed'})).toBeDisabled();
    });
  });

  describe('sort', function () {
    it('calls onSortChange with new sort value', function () {
      const mockOnSortChange = jest.fn();
      render(<WrappedComponent onSortChange={mockOnSortChange} />);

      userEvent.click(screen.getByRole('button', {name: 'Last Seen'}));

      userEvent.click(screen.getByText(/Number of events/));

      expect(mockOnSortChange).toHaveBeenCalledWith('freq');
    });
  });

  describe('performance issues', function () {
    it('disables options that are not supported for performance issues', () => {
      jest
        .spyOn(SelectedGroupStore, 'getSelectedIds')
        .mockImplementation(() => new Set(['1', '2']));
      jest.spyOn(GroupStore, 'get').mockImplementation(id => {
        switch (id) {
          case '1':
            return TestStubs.Group({
              issueCategory: IssueCategory.ERROR,
            });
          default:
            return TestStubs.Group({
              issueCategory: IssueCategory.PERFORMANCE,
            });
        }
      });

      render(<WrappedComponent />);

      // Resolve and ignore are supported
      expect(screen.getByRole('button', {name: 'Resolve'})).toBeEnabled();
      expect(screen.getByRole('button', {name: 'Ignore'})).toBeEnabled();

      // Merge is not supported and should be disabled
      expect(screen.getByRole('button', {name: 'Merge Selected Issues'})).toBeDisabled();

      // Open overflow menu
      userEvent.click(screen.getByRole('button', {name: 'More issue actions'}));

      // 'Add to Bookmarks' is supported
      expect(
        screen.getByRole('menuitemradio', {name: 'Add to Bookmarks'})
      ).toHaveAttribute('aria-disabled', 'false');

      // Deleting is not supported and menu item should be disabled
      expect(screen.getByRole('menuitemradio', {name: 'Delete'})).toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });

    describe('bulk action performance issues', function () {
      const orgWithPerformanceIssues = TestStubs.Organization({
        features: ['performance-issues'],
      });

      it('silently filters out performance issues when bulk deleting', function () {
        const bulkDeleteMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/issues/',
          method: 'DELETE',
        });

        render(
          <Fragment>
            <GlobalModal />
            <IssueListActions {...defaultProps} query="is:unresolved" queryCount={100} />
          </Fragment>,
          {organization: orgWithPerformanceIssues}
        );

        userEvent.click(screen.getByRole('checkbox'));

        userEvent.click(screen.getByTestId('issue-list-select-all-notice-link'));

        userEvent.click(screen.getByRole('button', {name: 'More issue actions'}));
        userEvent.click(screen.getByRole('menuitemradio', {name: 'Delete'}));

        const modal = screen.getByRole('dialog');

        expect(
          within(modal).getByText(/deleting performance issues is not yet supported/i)
        ).toBeInTheDocument();

        userEvent.click(within(modal).getByRole('button', {name: 'Bulk delete issues'}));

        expect(bulkDeleteMock).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: expect.objectContaining({
              query: 'is:unresolved issue.category:error',
            }),
          })
        );
      });

      it('silently filters out performance issues when bulk merging', async function () {
        const bulkMergeMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/issues/',
          method: 'PUT',
        });

        // Ensure that all issues have the same project so we can merge
        jest
          .spyOn(GroupStore, 'get')
          .mockReturnValue(
            TestStubs.Group({project: TestStubs.Project({slug: 'project-1'})})
          );

        render(
          <Fragment>
            <GlobalModal />
            <IssueListActions {...defaultProps} query="is:unresolved" queryCount={100} />
          </Fragment>,
          {organization: orgWithPerformanceIssues}
        );

        userEvent.click(screen.getByRole('checkbox'));

        userEvent.click(screen.getByTestId('issue-list-select-all-notice-link'));

        userEvent.click(screen.getByRole('button', {name: 'Merge Selected Issues'}));

        const modal = screen.getByRole('dialog');

        expect(
          within(modal).getByText(/merging performance issues is not yet supported/i)
        ).toBeInTheDocument();

        // Wait for ProjectStore to update before closing the modal
        await act(tick);

        userEvent.click(within(modal).getByRole('button', {name: 'Bulk merge issues'}));

        expect(bulkMergeMock).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: expect.objectContaining({
              query: 'is:unresolved issue.category:error',
            }),
          })
        );
      });
    });
  });
});
