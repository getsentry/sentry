import {Fragment} from 'react';

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

const defaultProps = {
  query: 'is:unresolved',
  sort: IssueSortOptions.DATE,
};

describe('IssueViewSaveButton', function () {
  it('can create a new view when no view is selected', async function () {
    const mockCreateIssueView = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/group-search-views/',
      method: 'POST',
      body: {
        id: 100,
        name: 'My View',
        projects: [1],
        query: 'is:unresolved',
        querySort: IssueSortOptions.DATE,
        environments: ['prod'],
        timeFilters: {
          period: '1d',
          utc: null,
          start: null,
          end: null,
        },
      },
    });

    PageFiltersStore.onInitializeUrlState(
      {
        projects: [1],
        environments: ['prod'],
        datetime: {
          period: '1d',
          utc: null,
          start: null,
          end: null,
        },
      },
      new Set()
    );

    const {router} = render(
      <Fragment>
        <IssueViewSaveButton {...defaultProps} />
        <GlobalModal />
      </Fragment>,
      {
        enableRouterMocks: false,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/issues/',
          },
        },
      }
    );

    await userEvent.click(screen.getByRole('button', {name: 'Save As'}));

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
          timeFilters: {period: '1d', utc: null, start: null, end: null},
        },
      })
    );
  });

  it('can save as from an existing view', async function () {
    const mockCreateIssueView = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/group-search-views/',
      method: 'POST',
      body: {
        id: 100,
        name: 'My View',
        projects: [1],
        query: 'is:unresolved',
        querySort: IssueSortOptions.DATE,
        environments: ['prod'],
        timeFilters: {
          period: '1d',
          utc: null,
          start: null,
          end: null,
        },
      },
    });

    PageFiltersStore.onInitializeUrlState(
      {
        projects: [1],
        environments: ['prod'],
        datetime: {
          period: '1d',
          utc: null,
          start: null,
          end: null,
        },
      },
      new Set()
    );

    const {router} = render(
      <Fragment>
        <IssueViewSaveButton {...defaultProps} />
        <GlobalModal />
      </Fragment>,
      {
        enableRouterMocks: false,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/issues/views/100/',
          },
          route: '/organizations/:orgId/issues/views/:viewId/',
        },
      }
    );

    await userEvent.click(screen.getByRole('button', {name: 'More save options'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Save As'}));

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
          timeFilters: {period: '1d', utc: null, start: null, end: null},
        },
      })
    );
  });
});
