import {Fragment} from 'react';
import {Group as GroupFixture} from 'sentry-fixture/group';
import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';

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
import {IssueCategory} from 'sentry/types';
import * as analytics from 'sentry/utils/analytics';
import {IssueListActions} from 'sentry/views/issueList/actions';

const organization = Organization();

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
  displayReprocessingActions: false,
  onSortChange: jest.fn(),
  sort: '',
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
      body: [ProjectFixture({id: '1'})],
    });
  });

  describe('Bulk', function () {
    describe('Total results greater than bulk limit', function () {
      it('after checking "Select all" checkbox, displays bulk select message', async function () {
        render(<WrappedComponent queryCount={1500} />);

        await userEvent.click(screen.getByRole('checkbox'));
      });

      it('can bulk select', async function () {
        render(<WrappedComponent queryCount={1500} />);

        await userEvent.click(screen.getByRole('checkbox'));
        await userEvent.click(screen.getByTestId('issue-list-select-all-notice-link'));
      });

      it('bulk resolves', async function () {
        const apiMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/issues/',
          method: 'PUT',
        });

        render(<WrappedComponent queryCount={1500} />);
        await userEvent.click(screen.getByRole('checkbox'));

        await userEvent.click(screen.getByTestId('issue-list-select-all-notice-link'));

        await userEvent.click(screen.getByRole('button', {name: 'Resolve'}));

        await screen.findByRole('dialog');

        await userEvent.click(screen.getByRole('button', {name: 'Bulk resolve issues'}));

        expect(apiMock).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: {
              project: [1],
            },
            data: {status: 'resolved', statusDetails: {}, substatus: null},
          })
        );
      });
    });

    describe('Total results less than bulk limit', function () {
      it('after checking "Select all" checkbox, displays bulk select message', async function () {
        render(<WrappedComponent queryCount={15} />);

        await userEvent.click(screen.getByRole('checkbox'));
      });

      it('can bulk select', async function () {
        render(<WrappedComponent queryCount={15} />);

        await userEvent.click(screen.getByRole('checkbox'));

        await userEvent.click(screen.getByTestId('issue-list-select-all-notice-link'));
      });

      it('bulk resolves', async function () {
        const apiMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/issues/',
          method: 'PUT',
        });

        render(<WrappedComponent queryCount={15} />);

        await userEvent.click(screen.getByRole('checkbox'));

        await userEvent.click(screen.getByTestId('issue-list-select-all-notice-link'));

        await userEvent.click(screen.getByRole('button', {name: 'Resolve'}));

        const modal = screen.getByRole('dialog');

        await userEvent.click(
          within(modal).getByRole('button', {name: 'Bulk resolve issues'})
        );

        expect(apiMock).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: {
              project: [1],
            },
            data: {status: 'resolved', statusDetails: {}, substatus: null},
          })
        );
      });
    });

    describe('Selected on page', function () {
      it('resolves selected items', async function () {
        const apiMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/issues/',
          method: 'PUT',
        });

        jest.spyOn(SelectedGroupStore, 'getSelectedIds').mockReturnValue(new Set(['1']));

        render(<WrappedComponent groupIds={['1', '2', '3', '6', '9']} />);

        const resolveButton = screen.getByRole('button', {name: 'Resolve'});
        expect(resolveButton).toBeEnabled();
        await userEvent.click(resolveButton);

        expect(apiMock).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: {
              id: ['1'],
              project: [1],
            },
            data: {status: 'resolved', statusDetails: {}, substatus: null},
          })
        );
      });

      it('can ignore selected items (custom)', async function () {
        const analyticsSpy = jest.spyOn(analytics, 'trackAnalytics');
        const apiMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/issues/',
          method: 'PUT',
        });
        jest.spyOn(SelectedGroupStore, 'getSelectedIds').mockReturnValue(new Set(['1']));

        render(<WrappedComponent {...defaultProps} />);

        await userEvent.click(screen.getByRole('button', {name: 'Ignore options'}));
        fireEvent.click(screen.getByText(/Until this affects an additional/));
        await screen.findByTestId('until-affect-custom');
        await userEvent.click(screen.getByTestId('until-affect-custom'));

        const modal = screen.getByRole('dialog');

        await userEvent.clear(
          within(modal).getByRole('spinbutton', {name: 'Number of users'})
        );
        await userEvent.type(
          within(modal).getByRole('spinbutton', {name: 'Number of users'}),
          '300'
        );

        await userEvent.click(within(modal).getByRole('textbox'));
        await userEvent.click(within(modal).getByText('per week'));

        await userEvent.click(within(modal).getByRole('button', {name: 'Ignore'}));

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
              substatus: 'archived_until_condition_met',
            },
          })
        );

        expect(analyticsSpy).toHaveBeenCalledWith(
          'issues_stream.archived',
          expect.objectContaining({
            action_status_details: 'ignoreUserCount',
          })
        );
      });
    });
  });

  it('can archive an issue until escalating', async () => {
    const analyticsSpy = jest.spyOn(analytics, 'trackAnalytics');
    const org_escalating = {...organization, features: ['escalating-issues']};
    const apiMock = MockApiClient.addMockResponse({
      url: `/organizations/${org_escalating.slug}/issues/`,
      method: 'PUT',
    });
    jest.spyOn(SelectedGroupStore, 'getSelectedIds').mockReturnValue(new Set(['1']));

    render(<WrappedComponent {...defaultProps} />, {organization: org_escalating});

    await userEvent.click(screen.getByRole('button', {name: 'Archive'}));

    expect(apiMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {
          id: ['1'],
          project: [1],
        },
        data: {
          status: 'ignored',
          statusDetails: {},
          substatus: 'archived_until_escalating',
        },
      })
    );

    expect(analyticsSpy).toHaveBeenCalledWith(
      'issues_stream.archived',
      expect.objectContaining({
        action_substatus: 'archived_until_escalating',
      })
    );
  });

  it('can unarchive an issue when the query contains is:archived', async () => {
    const org_escalating = {...organization, features: ['escalating-issues']};
    const apiMock = MockApiClient.addMockResponse({
      url: `/organizations/${org_escalating.slug}/issues/`,
      method: 'PUT',
    });
    jest.spyOn(SelectedGroupStore, 'getSelectedIds').mockReturnValue(new Set(['1']));

    render(<WrappedComponent {...defaultProps} query="is:archived" />, {
      organization: org_escalating,
    });

    await userEvent.click(screen.getByRole('button', {name: 'Unarchive'}));

    expect(apiMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({id: ['1'], project: [1]}),
        data: {status: 'unresolved'},
      })
    );
  });

  it('can resolve but not merge issues from different projects', function () {
    jest
      .spyOn(SelectedGroupStore, 'getSelectedIds')
      .mockImplementation(() => new Set(['1', '2', '3']));
    jest.spyOn(GroupStore, 'get').mockImplementation(id => {
      switch (id) {
        case '1':
          return GroupFixture({project: ProjectFixture({slug: 'project-1'})});
        default:
          return GroupFixture({project: ProjectFixture({slug: 'project-2'})});
      }
    });

    render(<WrappedComponent />);

    // Can resolve but not merge issues from multiple projects
    expect(screen.getByRole('button', {name: 'Resolve'})).toBeEnabled();
    expect(screen.getByRole('button', {name: 'Merge Selected Issues'})).toBeDisabled();
  });

  describe('mark reviewed', function () {
    it('acknowledges group', async function () {
      const mockOnMarkReviewed = jest.fn();

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        method: 'PUT',
      });

      jest
        .spyOn(SelectedGroupStore, 'getSelectedIds')
        .mockImplementation(() => new Set(['1', '2', '3']));
      jest.spyOn(GroupStore, 'get').mockImplementation(id => {
        return GroupFixture({
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
      await userEvent.click(reviewButton);

      expect(mockOnMarkReviewed).toHaveBeenCalledWith(['1', '2', '3']);
    });

    it('mark reviewed disabled for group that is already reviewed', function () {
      SelectedGroupStore.add(['1']);
      SelectedGroupStore.toggleSelectAll();
      GroupStore.loadInitialData([GroupFixture({id: '1', inbox: null})]);

      render(<WrappedComponent {...defaultProps} />);

      expect(screen.getByRole('button', {name: 'Mark Reviewed'})).toBeDisabled();
    });
  });

  describe('sort', function () {
    it('calls onSortChange with new sort value', async function () {
      const mockOnSortChange = jest.fn();
      render(<WrappedComponent onSortChange={mockOnSortChange} />);

      await userEvent.click(screen.getByRole('button', {name: 'Last Seen'}));

      await userEvent.click(screen.getByText(/Number of events/));

      expect(mockOnSortChange).toHaveBeenCalledWith('freq');
    });
  });

  describe('performance issues', function () {
    it('disables options that are not supported for performance issues', async () => {
      jest
        .spyOn(SelectedGroupStore, 'getSelectedIds')
        .mockImplementation(() => new Set(['1', '2']));
      jest.spyOn(GroupStore, 'get').mockImplementation(id => {
        switch (id) {
          case '1':
            return GroupFixture({
              issueCategory: IssueCategory.ERROR,
            });
          default:
            return GroupFixture({
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
      await userEvent.click(screen.getByRole('button', {name: 'More issue actions'}));

      // 'Add to Bookmarks' is supported
      expect(
        screen.getByRole('menuitemradio', {name: 'Add to Bookmarks'})
      ).not.toHaveAttribute('aria-disabled');

      // Deleting is not supported and menu item should be disabled
      expect(screen.getByRole('menuitemradio', {name: 'Delete'})).toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });

    describe('bulk action performance issues', function () {
      const orgWithPerformanceIssues = Organization({
        features: ['performance-issues'],
      });

      it('silently filters out performance issues when bulk deleting', async function () {
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

        await userEvent.click(screen.getByRole('checkbox'));

        await userEvent.click(screen.getByTestId('issue-list-select-all-notice-link'));

        await userEvent.click(screen.getByRole('button', {name: 'More issue actions'}));
        await userEvent.click(screen.getByRole('menuitemradio', {name: 'Delete'}));

        const modal = screen.getByRole('dialog');

        expect(
          within(modal).getByText(/deleting performance issues is not yet supported/i)
        ).toBeInTheDocument();

        await userEvent.click(
          within(modal).getByRole('button', {name: 'Bulk delete issues'})
        );

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
          .mockReturnValue(GroupFixture({project: ProjectFixture({slug: 'project-1'})}));

        render(
          <Fragment>
            <GlobalModal />
            <IssueListActions {...defaultProps} query="is:unresolved" queryCount={100} />
          </Fragment>,
          {organization: orgWithPerformanceIssues}
        );

        await userEvent.click(screen.getByRole('checkbox'));

        await userEvent.click(screen.getByTestId('issue-list-select-all-notice-link'));

        await userEvent.click(
          screen.getByRole('button', {name: 'Merge Selected Issues'})
        );

        const modal = screen.getByRole('dialog');

        expect(
          within(modal).getByText(/merging performance issues is not yet supported/i)
        ).toBeInTheDocument();

        await userEvent.click(
          within(modal).getByRole('button', {name: 'Bulk merge issues'})
        );

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
