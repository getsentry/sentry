import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  fireEvent,
  render,
  screen,
  userEvent,
  within,
} from 'sentry-test/reactTestingLibrary';

import GlobalModal from 'sentry/components/globalModal';
import GroupStore from 'sentry/stores/groupStore';
import SelectedGroupStore from 'sentry/stores/selectedGroupStore';
import {IssueListActions} from 'sentry/views/issueList/actions';

describe('IssueListActions', function () {
  let org, defaultProps;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    const organization = initializeOrg();
    org = organization.org;

    GroupStore.reset();
    SelectedGroupStore.reset();
    SelectedGroupStore.add(['1', '2', '3']);

    defaultProps = {
      api: new MockApiClient(),
      allResultsVisible: false,
      query: '',
      queryCount: 15,
      organization: org,
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
    };
  });

  describe('Bulk', function () {
    describe('Total results greater than bulk limit', function () {
      it('after checking "Select all" checkbox, displays bulk select message', function () {
        render(<IssueListActions {...defaultProps} queryCount={1500} />);

        userEvent.click(screen.getByRole('checkbox'));

        expect(screen.getByTestId('issue-list-select-all-notice')).toSnapshot();
      });

      it('can bulk select', function () {
        render(<IssueListActions {...defaultProps} queryCount={1500} />);

        userEvent.click(screen.getByRole('checkbox'));
        userEvent.click(screen.getByTestId('issue-list-select-all-notice-link'));

        expect(screen.getByTestId('issue-list-select-all-notice')).toSnapshot();
      });

      it('bulk resolves', async function () {
        const apiMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/issues/',
          method: 'PUT',
        });

        render(
          <React.Fragment>
            <GlobalModal />
            <IssueListActions {...defaultProps} queryCount={1500} />
          </React.Fragment>
        );
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
        render(<IssueListActions {...defaultProps} queryCount={15} />);

        userEvent.click(screen.getByRole('checkbox'));

        expect(screen.getByTestId('issue-list-select-all-notice')).toSnapshot();
      });

      it('can bulk select', function () {
        render(<IssueListActions {...defaultProps} queryCount={15} />);

        userEvent.click(screen.getByRole('checkbox'));

        userEvent.click(screen.getByTestId('issue-list-select-all-notice-link'));

        expect(screen.getByTestId('issue-list-select-all-notice')).toSnapshot();
      });

      it('bulk resolves', function () {
        const apiMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/issues/',
          method: 'PUT',
        });

        render(
          <React.Fragment>
            <GlobalModal />
            <IssueListActions {...defaultProps} queryCount={15} />
          </React.Fragment>
        );

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

        render(
          <IssueListActions {...defaultProps} groupIds={['1', '2', '3', '6', '9']} />
        );

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

        render(
          <React.Fragment>
            <GlobalModal />
            <IssueListActions {...defaultProps} />
          </React.Fragment>
        );

        userEvent.click(screen.getByRole('button', {name: 'Ignore options'}));
        fireEvent.click(screen.getByText(/Until this affects an additional/));
        await screen.findByTestId('until-affect-custom');
        userEvent.click(screen.getByTestId('until-affect-custom'));

        const modal = screen.getByRole('dialog');

        userEvent.clear(within(modal).getByLabelText('Number of users'));
        userEvent.type(within(modal).getByLabelText('Number of users'), '300');

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

    render(<IssueListActions {...defaultProps} />);

    // Can resolve but not merge issues from multiple projects
    expect(screen.getByRole('button', {name: 'Resolve'})).toBeEnabled();
    expect(screen.getByRole('button', {name: 'Merge Selected Issues'})).toBeDisabled();
  });

  describe('mark reviewed', function () {
    it('acknowledges group', function () {
      const mockOnMarkReviewed = jest.fn();

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

      render(<IssueListActions {...defaultProps} onMarkReviewed={mockOnMarkReviewed} />);

      const reviewButton = screen.getByRole('button', {name: 'Mark Reviewed'});
      expect(reviewButton).toBeEnabled();
      userEvent.click(reviewButton);

      expect(mockOnMarkReviewed).toHaveBeenCalledWith(['1', '2', '3']);
    });

    it('mark reviewed disabled for group that is already reviewed', function () {
      SelectedGroupStore.add(['1']);
      SelectedGroupStore.toggleSelectAll();
      GroupStore.loadInitialData([TestStubs.Group({id: '1', inbox: null})]);

      render(<IssueListActions {...defaultProps} />);

      expect(screen.getByRole('button', {name: 'Mark Reviewed'})).toBeDisabled();
    });
  });

  describe('sort', function () {
    it('calls onSortChange with new sort value', function () {
      const mockOnSortChange = jest.fn();
      render(<IssueListActions {...defaultProps} onSortChange={mockOnSortChange} />);

      userEvent.click(screen.getByRole('button', {name: 'Last Seen'}));

      userEvent.click(screen.getByText(/Number of events/));

      expect(mockOnSortChange).toHaveBeenCalledWith('freq');
    });
  });
});
