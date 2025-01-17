import {Fragment} from 'react';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import GlobalModal from 'sentry/components/globalModal';
import {DEFAULT_QUERY} from 'sentry/constants';
import GroupStore from 'sentry/stores/groupStore';
import SelectedGroupStore from 'sentry/stores/selectedGroupStore';
import {IssueCategory} from 'sentry/types/group';
import * as analytics from 'sentry/utils/analytics';
import {IssueListActions} from 'sentry/views/issueList/actions';

const organization = OrganizationFixture();

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

function WrappedComponent(props: any) {
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

        await userEvent.click(screen.getByRole('checkbox', {name: 'Select all'}));
      });

      it('can bulk select', async function () {
        render(<WrappedComponent queryCount={1500} />);

        await userEvent.click(screen.getByRole('checkbox', {name: 'Select all'}));
        await userEvent.click(screen.getByTestId('issue-list-select-all-notice-link'));
      });

      it('bulk resolves', async function () {
        const apiMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/issues/',
          method: 'PUT',
        });

        render(<WrappedComponent queryCount={1500} />);
        await userEvent.click(screen.getByRole('checkbox', {name: 'Select all'}));

        await userEvent.click(screen.getByTestId('issue-list-select-all-notice-link'));

        await userEvent.click(await screen.findByRole('button', {name: 'Resolve'}));

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

      it('bulk sets priority', async function () {
        const apiMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/issues/',
          method: 'PUT',
        });

        render(<WrappedComponent queryCount={1500} />);

        await userEvent.click(screen.getByRole('checkbox', {name: 'Select all'}));
        await userEvent.click(screen.getByTestId('issue-list-select-all-notice-link'));
        await userEvent.click(await screen.findByRole('button', {name: 'Set Priority'}));
        await userEvent.click(screen.getByRole('menuitemradio', {name: 'High'}));

        expect(
          within(screen.getByRole('dialog')).getByText(
            'Are you sure you want to reprioritize to high the first 1,000 issues that match the search?'
          )
        ).toBeInTheDocument();

        await userEvent.click(
          screen.getByRole('button', {name: 'Bulk reprioritize issues'})
        );

        expect(apiMock).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: {
              project: [1],
            },
            data: {priority: 'high'},
          })
        );
      });
    });

    describe('Total results less than bulk limit', function () {
      it('after checking "Select all" checkbox, displays bulk select message', async function () {
        render(<WrappedComponent queryCount={15} />);

        const checkbox = screen.getByRole('checkbox', {name: 'Select all'});
        await userEvent.click(checkbox);
        expect(checkbox).toBeChecked();
        await userEvent.click(screen.getByTestId('issue-list-select-all-notice-link'));
      });

      it('bulk resolves', async function () {
        const apiMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/issues/',
          method: 'PUT',
        });

        render(<WrappedComponent queryCount={15} />);

        await userEvent.click(screen.getByRole('checkbox', {name: 'Select all'}));

        await userEvent.click(screen.getByTestId('issue-list-select-all-notice-link'));

        await userEvent.click(await screen.findByRole('button', {name: 'Resolve'}));

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
    });
  });

  it('can set priority', async function () {
    const apiMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      method: 'PUT',
    });
    jest.spyOn(SelectedGroupStore, 'getSelectedIds').mockReturnValue(new Set(['1']));

    render(<WrappedComponent {...defaultProps} />);

    await userEvent.click(screen.getByRole('button', {name: 'Set Priority'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'High'}));

    expect(apiMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {
          id: ['1'],
          project: [1],
        },
        data: {priority: 'high'},
      })
    );
  });

  it('can archive an issue until escalating', async () => {
    const analyticsSpy = jest.spyOn(analytics, 'trackAnalytics');
    const apiMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      method: 'PUT',
    });
    jest.spyOn(SelectedGroupStore, 'getSelectedIds').mockReturnValue(new Set(['1']));

    render(<WrappedComponent {...defaultProps} />, {organization});

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
    const apiMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      method: 'PUT',
    });
    jest.spyOn(SelectedGroupStore, 'getSelectedIds').mockReturnValue(new Set(['1']));

    render(<WrappedComponent {...defaultProps} query="is:archived" />, {
      organization,
    });

    await userEvent.click(screen.getByRole('button', {name: 'Unarchive'}));

    expect(apiMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({id: ['1'], project: [1]}),
        data: {status: 'unresolved', statusDetails: {}},
      })
    );
  });

  it('can resolve but not merge issues from different projects', async function () {
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
    expect(await screen.findByRole('button', {name: 'Resolve'})).toBeEnabled();
    await userEvent.click(screen.getByRole('button', {name: 'More issue actions'}));
    expect(screen.getByRole('menuitemradio', {name: 'Merge'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('sets the project ID when My Projects is selected', async function () {
    jest
      .spyOn(SelectedGroupStore, 'getSelectedIds')
      .mockImplementation(() => new Set(['1']));
    jest
      .spyOn(GroupStore, 'get')
      .mockImplementation(id =>
        GroupFixture({id, project: ProjectFixture({id: '123', slug: 'project-1'})})
      );

    const apiMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      method: 'PUT',
    });

    render(
      <WrappedComponent
        selection={{
          // No selected projects => My Projects
          projects: [],
          environments: [],
          datetime: {start: null, end: null, period: null, utc: true},
        }}
      />
    );

    await userEvent.click(await screen.findByRole('button', {name: 'Resolve'}));

    // API request should have project ID set to 123
    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: {
            id: ['1'],
            project: ['123'],
          },
        })
      );
    });
  });

  describe('mark reviewed', function () {
    it('acknowledges group', async function () {
      const mockOnActionTaken = jest.fn();

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
      render(<WrappedComponent onActionTaken={mockOnActionTaken} />);

      await userEvent.click(screen.getByRole('button', {name: 'More issue actions'}));
      const reviewButton = screen.getByRole('menuitemradio', {name: 'Mark Reviewed'});
      await userEvent.click(reviewButton);

      expect(mockOnActionTaken).toHaveBeenCalledWith(['1', '2', '3'], {inbox: false});
    });

    it('mark reviewed disabled for group that is already reviewed', async function () {
      SelectedGroupStore.add(['1']);
      SelectedGroupStore.toggleSelectAll();
      GroupStore.loadInitialData([GroupFixture({id: '1', inbox: null})]);

      render(<WrappedComponent {...defaultProps} />);

      await userEvent.click(screen.getByRole('button', {name: 'More issue actions'}));
      expect(
        await screen.findByRole('menuitemradio', {name: 'Mark Reviewed'})
      ).toHaveAttribute('aria-disabled', 'true');
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
      expect(screen.getByRole('button', {name: 'Archive'})).toBeEnabled();

      // Open overflow menu
      await userEvent.click(screen.getByRole('button', {name: 'More issue actions'}));

      // Merge is not supported and should be disabled
      expect(screen.getByRole('menuitemradio', {name: 'Merge'})).toHaveAttribute(
        'aria-disabled',
        'true'
      );

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
      const orgWithPerformanceIssues = OrganizationFixture({
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
            <IssueListActions {...defaultProps} query={DEFAULT_QUERY} queryCount={100} />
          </Fragment>,
          {organization: orgWithPerformanceIssues}
        );

        await userEvent.click(screen.getByRole('checkbox', {name: 'Select all'}));

        await userEvent.click(screen.getByTestId('issue-list-select-all-notice-link'));

        await userEvent.click(
          await screen.findByRole('button', {name: 'More issue actions'})
        );
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
              query: DEFAULT_QUERY + ' issue.category:error',
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
            <IssueListActions {...defaultProps} query={DEFAULT_QUERY} queryCount={100} />
          </Fragment>,
          {organization: orgWithPerformanceIssues}
        );

        await userEvent.click(screen.getByRole('checkbox', {name: 'Select all'}));

        await userEvent.click(screen.getByTestId('issue-list-select-all-notice-link'));

        await userEvent.click(
          await screen.findByRole('button', {name: 'More issue actions'})
        );

        await userEvent.click(screen.getByRole('menuitemradio', {name: 'Merge'}));

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
              query: DEFAULT_QUERY + ' issue.category:error',
            }),
          })
        );
      });
    });
  });
});
