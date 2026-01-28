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
import GroupStore from 'sentry/stores/groupStore';
import SelectedGroupStore from 'sentry/stores/selectedGroupStore';
import {IssueCategory} from 'sentry/types/group';
import * as analytics from 'sentry/utils/analytics';
import {IssueListActions} from 'sentry/views/issueList/actions';
import {DEFAULT_QUERY} from 'sentry/views/issueList/utils';

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
};

function WrappedComponent(props: any) {
  return (
    <Fragment>
      <GlobalModal />
      <IssueListActions {...defaultProps} {...props} />
    </Fragment>
  );
}

describe('IssueListActions', () => {
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

  describe('selection state', () => {
    it('hides action buttons when nothing is selected', () => {
      render(<WrappedComponent />);

      expect(screen.queryByRole('button', {name: 'Resolve'})).not.toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Archive'})).not.toBeInTheDocument();
    });

    it('shows action buttons when any items are selected', () => {
      SelectedGroupStore.toggleSelect('1');
      render(<WrappedComponent />);

      expect(screen.getByRole('button', {name: 'Resolve'})).toBeEnabled();
      expect(screen.getByRole('button', {name: 'Archive'})).toBeEnabled();
    });

    it('shows select all checkbox as checked when all items are selected', () => {
      SelectedGroupStore.toggleSelect('1');
      SelectedGroupStore.toggleSelect('2');
      SelectedGroupStore.toggleSelect('3');
      render(<WrappedComponent />);

      // When all selected, label changes to "Deselect all"
      expect(screen.getByRole('checkbox', {name: 'Deselect all'})).toBeChecked();
    });

    it('shows select all checkbox as indeterminate when some items are selected', () => {
      SelectedGroupStore.toggleSelect('1');
      render(<WrappedComponent />);

      const checkbox = screen.getByRole('checkbox', {name: 'Select all'});
      expect(checkbox).toBePartiallyChecked();
    });
  });

  describe('Bulk', () => {
    describe('Total results greater than bulk limit', () => {
      it('after checking "Select all" checkbox, displays bulk select message', async () => {
        render(<WrappedComponent queryCount={1500} />);

        await userEvent.click(screen.getByRole('checkbox', {name: 'Select all'}));
      });

      it('bulk resolves', async () => {
        const apiMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/issues/',
          method: 'PUT',
        });

        render(<WrappedComponent queryCount={1500} />);
        await userEvent.click(screen.getByRole('checkbox', {name: 'Select all'}));

        await userEvent.click(
          screen.getByText(/Select the first 1,000 issues that match this search query/)
        );

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

      it('bulk sets priority', async () => {
        const apiMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/issues/',
          method: 'PUT',
        });

        render(<WrappedComponent queryCount={1500} />);

        await userEvent.click(screen.getByRole('checkbox', {name: 'Select all'}));
        await userEvent.click(
          screen.getByText(/Select the first 1,000 issues that match this search query/)
        );
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

    describe('Total results less than bulk limit', () => {
      it('after checking "Select all" checkbox, displays bulk select message', async () => {
        render(<WrappedComponent queryCount={15} />);

        const checkbox = screen.getByRole('checkbox', {name: 'Select all'});
        await userEvent.click(checkbox);
        expect(checkbox).toBeChecked();
        await userEvent.click(
          screen.getByText(/Select all 15 issues that match this search query/)
        );
      });

      it('bulk resolves', async () => {
        const apiMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/issues/',
          method: 'PUT',
        });

        render(<WrappedComponent queryCount={15} />);

        await userEvent.click(screen.getByRole('checkbox', {name: 'Select all'}));

        await userEvent.click(
          screen.getByText(/Select all 15 issues that match this search query/)
        );

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

    describe('Selected on page', () => {
      it('resolves selected items', async () => {
        const apiMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/issues/',
          method: 'PUT',
        });

        SelectedGroupStore.toggleSelect('1');

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

  it('can set priority', async () => {
    const apiMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      method: 'PUT',
    });
    SelectedGroupStore.toggleSelect('1');

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
    SelectedGroupStore.toggleSelect('1');

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
    SelectedGroupStore.toggleSelect('1');

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

  it('can resolve but not merge issues from different projects', async () => {
    SelectedGroupStore.toggleSelect('1');
    SelectedGroupStore.toggleSelect('2');
    SelectedGroupStore.toggleSelect('3');
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
    expect(screen.getByRole('button', {name: 'Merge'})).toBeDisabled();
  });

  it('sets the project ID when My Projects is selected', async () => {
    SelectedGroupStore.toggleSelect('1');
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

  describe('mark reviewed', () => {
    it('acknowledges group', async () => {
      const mockOnActionTaken = jest.fn();

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        method: 'PUT',
      });

      SelectedGroupStore.toggleSelect('1');
      SelectedGroupStore.toggleSelect('2');
      SelectedGroupStore.toggleSelect('3');
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

    it('mark reviewed disabled for group that is already reviewed', async () => {
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

  describe('performance issues', () => {
    it('disables options that are not supported for performance issues', async () => {
      SelectedGroupStore.toggleSelect('1');
      SelectedGroupStore.toggleSelect('2');
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

      // Merge is not supported and should be disabled
      expect(screen.getByRole('button', {name: 'Merge'})).toBeDisabled();

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

    it('disables delete if user does not have permission to delete issues', async () => {
      SelectedGroupStore.toggleSelect('1');
      SelectedGroupStore.toggleSelect('2');
      jest.spyOn(GroupStore, 'get').mockImplementation(id => {
        return GroupFixture({id});
      });

      render(<WrappedComponent />);

      await userEvent.click(screen.getByRole('button', {name: 'More issue actions'}));
      expect(screen.getByRole('menuitemradio', {name: 'Delete'})).toHaveAttribute(
        'aria-disabled',
        'true'
      );
      expect(screen.getByRole('menuitemradio', {name: 'Delete'})).toHaveTextContent(
        'You do not have permission to delete issues'
      );
    });

    describe('bulk action performance issues', () => {
      const orgWithPerformanceIssues = OrganizationFixture({
        features: ['performance-issues'],
        access: ['event:admin'],
      });

      it('silently filters out performance issues when bulk deleting', async () => {
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

        await userEvent.click(
          screen.getByText(/Select all 100 issues that match this search query/)
        );

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

      it('silently filters out performance issues when bulk merging', async () => {
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

        await userEvent.click(
          screen.getByText(/Select all 100 issues that match this search query/)
        );

        await userEvent.click(screen.getByRole('button', {name: 'Merge'}));

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

      it('shows merge button when multiple issues are selected', async () => {
        // Ensure that all issues have the same project so we can merge
        jest
          .spyOn(GroupStore, 'get')
          .mockReturnValue(GroupFixture({project: ProjectFixture({slug: 'project-1'})}));

        render(
          <Fragment>
            <GlobalModal />
            <IssueListActions {...defaultProps} queryCount={100} />
          </Fragment>
        );

        await userEvent.click(screen.getByRole('checkbox', {name: 'Select all'}));

        await userEvent.click(
          screen.getByText(/Select all 100 issues that match this search query/)
        );

        // Should show merge button directly when multiple issues are selected
        expect(screen.getByRole('button', {name: 'Merge'})).toBeInTheDocument();
      });
    });
  });
});
