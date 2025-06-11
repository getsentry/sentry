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

describe('IssueViewSaveButton', function () {
  PageFiltersStore.onInitializeUrlState(defaultPageFilters, new Set());

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/group-search-views/100/',
      body: mockGroupSearchView,
    });
  });

  it('can create a new view when no view is selected', async function () {
    const mockCreateIssueView = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/group-search-views/',
      method: 'POST',
      body: mockGroupSearchView,
    });

    PageFiltersStore.onInitializeUrlState(defaultPageFilters, new Set());

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

  it('can save as from an existing view', async function () {
    const mockCreateIssueView = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/group-search-views/',
      method: 'POST',
      body: mockGroupSearchView,
    });

    PageFiltersStore.onInitializeUrlState(defaultPageFilters, new Set());

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

  it('can save changes to a view that user has edit access to', async function () {
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

  it('can save as a new view when user has no edit access', async function () {
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

    PageFiltersStore.onInitializeUrlState(defaultPageFilters, new Set());

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

  it('can discard unsaved changes', async function () {
    PageFiltersStore.onInitializeUrlState(defaultPageFilters, new Set());

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

  it('shows a feature disabled hovercard when the feature is disabled', async function () {
    render(<IssueViewSaveButton {...defaultProps} />, {
      organization: OrganizationFixture({
        features: [],
      }),
    });
    expect(await screen.findByRole('button', {name: 'Save As'})).toBeDisabled();
  });
});
