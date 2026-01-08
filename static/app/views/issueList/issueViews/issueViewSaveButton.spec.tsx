import {Fragment} from 'react';
import {GroupSearchViewFixture} from 'sentry-fixture/groupSearchView';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import GlobalModal from 'sentry/components/globalModal';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {IssueViewSaveButton} from 'sentry/views/issueList/issueViews/issueViewSaveButton';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

const organization = OrganizationFixture({
  features: ['issue-views'],
});

const defaultProps = {
  query: 'is:unresolved',
  sort: IssueSortOptions.DATE,
};

const mockGroupSearchView = GroupSearchViewFixture({id: '100'});
const defaultPageFilters = {
  projects: [1],
  environments: ['prod'],
  datetime: {
    period: '7d',
    utc: null,
    start: null,
    end: null,
  },
};

const initialRouterConfigFeed = {
  location: {
    pathname: '/organizations/org-slug/issues/',
  },
  route: '/organizations/:orgId/issues/',
};

const initialRouterConfigView = {
  location: {
    pathname: '/organizations/org-slug/issues/views/100/',
  },
  route: '/organizations/:orgId/issues/views/:viewId/',
};

describe('IssueViewSaveButton', () => {
  PageFiltersStore.onInitializeUrlState(defaultPageFilters);

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/group-search-views/100/',
      body: mockGroupSearchView,
    });
  });

  it('can create a new view when no view is selected', async () => {
    const mockCreateIssueView = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/group-search-views/',
      method: 'POST',
      body: mockGroupSearchView,
    });

    PageFiltersStore.onInitializeUrlState(defaultPageFilters);

    const {router} = render(
      <Fragment>
        <IssueViewSaveButton {...defaultProps} />
        <GlobalModal />
      </Fragment>,
      {
        initialRouterConfig: initialRouterConfigFeed,
        organization,
      }
    );

    await userEvent.click(await screen.findByRole('button', {name: 'Save As'}));

    const modal = screen.getByRole('dialog');

    expect(modal).toBeInTheDocument();

    const nameInput = within(modal).getByRole('textbox', {name: 'Name'});

    await userEvent.type(nameInput, 'My View');

    await userEvent.click(screen.getByRole('button', {name: 'Create View'}));

    await waitFor(() => {
      expect(router.location.pathname).toBe('/organizations/org-slug/issues/views/100/');
    });

    expect(mockCreateIssueView).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {
          name: 'My View',
          query: 'is:unresolved',
          querySort: IssueSortOptions.DATE,
          projects: [1],
          environments: ['prod'],
          timeFilters: {period: '7d', utc: null, start: null, end: null},
          starred: true,
        },
      })
    );
  });

  it('can save as from an existing view', async () => {
    const mockCreateIssueView = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/group-search-views/',
      method: 'POST',
      body: mockGroupSearchView,
    });

    PageFiltersStore.onInitializeUrlState(defaultPageFilters);

    const {router} = render(
      <Fragment>
        <IssueViewSaveButton {...defaultProps} />
        <GlobalModal />
      </Fragment>,
      {
        initialRouterConfig: initialRouterConfigView,
        organization,
      }
    );

    await userEvent.click(screen.getByRole('button', {name: 'More save options'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Save as new view'}));

    const modal = screen.getByRole('dialog');

    expect(modal).toBeInTheDocument();

    const nameInput = within(modal).getByRole('textbox', {name: 'Name'});

    expect(nameInput).toHaveValue(`${mockGroupSearchView.name} (Copy)`);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'My View');

    await userEvent.click(screen.getByRole('button', {name: 'Create View'}));

    await waitFor(() => {
      expect(router.location.pathname).toBe('/organizations/org-slug/issues/views/100/');
    });

    expect(mockCreateIssueView).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {
          name: 'My View',
          query: 'is:unresolved',
          querySort: IssueSortOptions.DATE,
          projects: [1],
          environments: ['prod'],
          timeFilters: {period: '7d', utc: null, start: null, end: null},
          starred: true,
        },
      })
    );
  });

  it('can save changes to a view that user has edit access to', async () => {
    const mockUpdateIssueView = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/group-search-views/100/',
      method: 'PUT',
      body: {...mockGroupSearchView, environments: ['dev']},
    });

    render(<IssueViewSaveButton {...defaultProps} />, {
      initialRouterConfig: {
        ...initialRouterConfigView,
        location: {
          pathname: '/organizations/org-slug/issues/views/100/',
          query: {
            project: '1',
            environment: 'dev', // different from default of 'prod'
            statsPeriod: '7d',
            query: 'is:unresolved',
            sort: IssueSortOptions.DATE,
          },
        },
      },
      organization,
    });

    // Should show unsaved changes
    await screen.findByTestId('save-button-unsaved');

    // Clicking save should update the view and clear unsaved changes
    await userEvent.click(await screen.findByRole('button', {name: 'Save'}));

    await waitFor(() => {
      // The save button should no longer show unsaved changes
      expect(screen.queryByTestId('save-button-unsaved')).not.toBeInTheDocument();
    });

    expect(mockUpdateIssueView).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          environments: ['dev'],
        }),
      })
    );
  });

  it('can save as a new view when user has no edit access', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/group-search-views/100/',
      body: {
        ...mockGroupSearchView,
        // Created by another user
        createdBy: UserFixture({id: '98765'}),
      },
    });
    const mockCreateIssueView = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/group-search-views/',
      method: 'POST',
      body: mockGroupSearchView,
    });

    PageFiltersStore.onInitializeUrlState(defaultPageFilters);

    const {router} = render(
      <Fragment>
        <IssueViewSaveButton {...defaultProps} />
        <GlobalModal />
      </Fragment>,
      {
        organization: OrganizationFixture({
          access: ['org:read'],
          features: ['issue-views'],
        }),
        initialRouterConfig: initialRouterConfigView,
      }
    );

    await userEvent.click(screen.getByRole('button', {name: 'Save As'}));

    const modal = screen.getByRole('dialog');

    expect(modal).toBeInTheDocument();

    const nameInput = within(modal).getByRole('textbox', {name: 'Name'});

    expect(nameInput).toHaveValue(`${mockGroupSearchView.name} (Copy)`);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'My View');

    await userEvent.click(screen.getByRole('button', {name: 'Create View'}));

    await waitFor(() => {
      expect(router.location.pathname).toBe('/organizations/org-slug/issues/views/100/');
    });

    expect(mockCreateIssueView).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {
          name: 'My View',
          query: 'is:unresolved',
          querySort: IssueSortOptions.DATE,
          projects: [1],
          environments: ['prod'],
          timeFilters: {period: '7d', utc: null, start: null, end: null},
          starred: true,
        },
      })
    );
  });

  it('can discard unsaved changes', async () => {
    PageFiltersStore.onInitializeUrlState(defaultPageFilters);

    const {router} = render(<IssueViewSaveButton {...defaultProps} />, {
      initialRouterConfig: {
        ...initialRouterConfigView,
        location: {
          pathname: '/organizations/org-slug/issues/views/100/',
          query: {
            project: '1',
            environment: 'dev', // different from default of 'prod'
            statsPeriod: '7d',
            query: 'is:unresolved',
            sort: IssueSortOptions.DATE,
          },
        },
      },
      organization,
    });

    await screen.findByTestId('save-button-unsaved');

    await userEvent.click(screen.getByRole('button', {name: 'More save options'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Reset'}));

    // Discarding unsaved changes should reset URL query params
    await waitFor(() => {
      expect(router.location.query).toEqual({
        project: '1',
        environment: 'prod',
        statsPeriod: '7d',
        query: 'is:unresolved',
        sort: IssueSortOptions.DATE,
      });
    });

    expect(router.location.pathname).toBe('/organizations/org-slug/issues/views/100/');

    // The save button should no longer show unsaved changes
    expect(screen.getByTestId('save-button')).toBeInTheDocument();
  });

  it('shows a feature disabled hovercard when the feature is disabled', async () => {
    render(<IssueViewSaveButton {...defaultProps} />, {
      organization: OrganizationFixture({
        features: [],
      }),
    });
    expect(await screen.findByRole('button', {name: 'Save As'})).toBeDisabled();
  });

  describe('AI title generation on save', () => {
    it('generates title when saving a view with default "New View" name and feature flag enabled', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/group-search-views/100/',
        body: {...mockGroupSearchView, name: 'New View'},
      });
      const mockGenerateTitle = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issue-view-title/generate/',
        method: 'POST',
        body: {title: 'Unresolved Errors'},
      });
      const mockUpdateIssueView = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/group-search-views/100/',
        method: 'PUT',
        body: {...mockGroupSearchView, name: 'Unresolved Errors'},
      });

      render(<IssueViewSaveButton {...defaultProps} />, {
        initialRouterConfig: {
          ...initialRouterConfigView,
          location: {
            pathname: '/organizations/org-slug/issues/views/100/',
            query: {
              project: '1',
              environment: 'dev',
              statsPeriod: '7d',
              query: 'is:unresolved',
              sort: IssueSortOptions.DATE,
            },
          },
        },
        organization: OrganizationFixture({
          features: ['issue-views', 'issue-view-ai-title'],
        }),
      });

      await userEvent.click(await screen.findByRole('button', {name: 'Save'}));

      await waitFor(() => {
        expect(mockGenerateTitle).toHaveBeenCalledWith(
          '/organizations/org-slug/issue-view-title/generate/',
          expect.objectContaining({
            method: 'POST',
            data: {query: 'is:unresolved'},
          })
        );
      });

      await waitFor(() => {
        expect(mockUpdateIssueView).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            data: expect.objectContaining({
              name: 'Unresolved Errors',
            }),
          })
        );
      });
    });

    it('does not generate title when feature flag is disabled', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/group-search-views/100/',
        body: {...mockGroupSearchView, name: 'New View'},
      });
      const mockGenerateTitle = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issue-view-title/generate/',
        method: 'POST',
        body: {title: 'Generated Title'},
      });
      const mockUpdateIssueView = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/group-search-views/100/',
        method: 'PUT',
        body: {...mockGroupSearchView, name: 'New View'},
      });

      render(<IssueViewSaveButton {...defaultProps} />, {
        initialRouterConfig: {
          ...initialRouterConfigView,
          location: {
            pathname: '/organizations/org-slug/issues/views/100/',
            query: {
              project: '1',
              environment: 'dev',
              statsPeriod: '7d',
              query: 'is:unresolved',
              sort: IssueSortOptions.DATE,
            },
          },
        },
        organization: OrganizationFixture({
          features: ['issue-views'],
        }),
      });

      await userEvent.click(await screen.findByRole('button', {name: 'Save'}));

      await waitFor(() => {
        expect(mockUpdateIssueView).toHaveBeenCalled();
      });

      expect(mockGenerateTitle).not.toHaveBeenCalled();
    });

    it('does not generate title when view has custom name', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/group-search-views/100/',
        body: {...mockGroupSearchView, name: 'My Custom View'},
      });
      const mockGenerateTitle = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issue-view-title/generate/',
        method: 'POST',
        body: {title: 'Generated Title'},
      });
      const mockUpdateIssueView = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/group-search-views/100/',
        method: 'PUT',
        body: {...mockGroupSearchView, name: 'My Custom View'},
      });

      render(<IssueViewSaveButton {...defaultProps} />, {
        initialRouterConfig: {
          ...initialRouterConfigView,
          location: {
            pathname: '/organizations/org-slug/issues/views/100/',
            query: {
              project: '1',
              environment: 'dev',
              statsPeriod: '7d',
              query: 'is:unresolved',
              sort: IssueSortOptions.DATE,
            },
          },
        },
        organization: OrganizationFixture({
          features: ['issue-views', 'issue-view-ai-title'],
        }),
      });

      await userEvent.click(await screen.findByRole('button', {name: 'Save'}));

      await waitFor(() => {
        expect(mockUpdateIssueView).toHaveBeenCalled();
      });

      expect(mockGenerateTitle).not.toHaveBeenCalled();
    });

    it('falls back to existing name when title generation fails', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/group-search-views/100/',
        body: {...mockGroupSearchView, name: 'New View'},
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issue-view-title/generate/',
        method: 'POST',
        statusCode: 500,
        body: {detail: 'Internal error'},
      });
      const mockUpdateIssueView = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/group-search-views/100/',
        method: 'PUT',
        body: {...mockGroupSearchView, name: 'New View'},
      });

      render(<IssueViewSaveButton {...defaultProps} />, {
        initialRouterConfig: {
          ...initialRouterConfigView,
          location: {
            pathname: '/organizations/org-slug/issues/views/100/',
            query: {
              project: '1',
              environment: 'dev',
              statsPeriod: '7d',
              query: 'is:unresolved',
              sort: IssueSortOptions.DATE,
            },
          },
        },
        organization: OrganizationFixture({
          features: ['issue-views', 'issue-view-ai-title'],
        }),
      });

      await userEvent.click(await screen.findByRole('button', {name: 'Save'}));

      await waitFor(() => {
        expect(mockUpdateIssueView).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            data: expect.objectContaining({
              name: 'New View',
            }),
          })
        );
      });
    });
  });
});
