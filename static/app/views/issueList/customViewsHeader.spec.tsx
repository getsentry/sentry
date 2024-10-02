import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import CustomViewsIssueListHeader from 'sentry/views/issueList/customViewsHeader';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

describe('CustomViewsHeader', () => {
  const organization = OrganizationFixture();

  const getRequestViews = [
    {
      id: '1',
      name: 'High Priority',
      query: 'priority:high',
      querySort: IssueSortOptions.DATE,
    },
    {
      id: '2',
      name: 'Medium Priority',
      query: 'priority:medium',
      querySort: IssueSortOptions.DATE,
    },
    {
      id: '3',
      name: 'Low Priority',
      query: 'priority:low',
      querySort: IssueSortOptions.NEW,
    },
  ];

  const defaultRouter = RouterFixture({
    location: LocationFixture({
      pathname: `/organizations/${organization.slug}/issues/`,
      query: {},
    }),
  });

  const unsavedTabRouter = RouterFixture({
    location: LocationFixture({
      pathname: `/organizations/${organization.slug}/issues/`,
      query: {
        query: 'is:unresolved',
        viewId: getRequestViews[0].id,
      },
    }),
  });

  const queryOnlyRouter = RouterFixture({
    location: LocationFixture({
      pathname: `/organizations/${organization.slug}/issues/`,
      query: {
        query: 'is:unresolved',
      },
    }),
  });

  const defaultProps = {
    organization,
    onRealtimeChange: jest.fn(),
    realtimeActive: false,
    router: defaultRouter,
    selectedProjectIds: [],
  };

  describe('CustomViewsHeader initialization and router behavior', () => {
    beforeEach(() => {
      MockApiClient.clearMockResponses();
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/group-search-views/`,
        method: 'GET',
        body: getRequestViews,
      });
    });

    it('renders all tabs, selects the first one by default, and replaces the query params accordingly', async () => {
      render(<CustomViewsIssueListHeader {...defaultProps} />, {router: defaultRouter});

      expect(await screen.findByRole('tab', {name: 'High Priority'})).toBeInTheDocument();
      expect(screen.getByRole('tab', {name: 'Medium Priority'})).toBeInTheDocument();
      expect(screen.getByRole('tab', {name: 'Low Priority'})).toBeInTheDocument();
      expect(screen.getByRole('tab', {name: 'High Priority'})).toHaveAttribute(
        'aria-selected',
        'true'
      );

      expect(
        screen.getByRole('button', {name: 'High Priority Ellipsis Menu'})
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Medium Priority Ellipsis Menu'})
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Low Priority Ellipsis Menu'})
      ).not.toBeInTheDocument();

      expect(defaultRouter.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            query: getRequestViews[0].query,
            viewId: getRequestViews[0].id,
            sort: getRequestViews[0].querySort,
          }),
        })
      );
    });

    it('switches tabs when clicked, and updates the query params accordingly', async () => {
      render(<CustomViewsIssueListHeader {...defaultProps} />, {router: defaultRouter});

      await userEvent.click(await screen.findByRole('tab', {name: 'Medium Priority'}));
      expect(await screen.getByRole('tab', {name: 'High Priority'})).toHaveAttribute(
        'aria-selected',
        'false'
      );
      expect(screen.getByRole('tab', {name: 'Medium Priority'})).toHaveAttribute(
        'aria-selected',
        'true'
      );
      // Note that this is a push call, not a replace call
      expect(defaultRouter.push).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            query: getRequestViews[1].query,
            viewId: getRequestViews[1].id,
            sort: getRequestViews[1].querySort,
          }),
        })
      );
    });

    it('creates a default viewId if no id is present in the request views', async () => {
      MockApiClient.clearMockResponses();
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/group-search-views/`,
        method: 'GET',
        body: [
          {
            name: 'Prioritized',
            query: 'is:unresolved issue.priority:[high, medium]',
            querySort: IssueSortOptions.DATE,
          },
        ],
      });

      render(<CustomViewsIssueListHeader {...defaultProps} />, {router: defaultRouter});

      expect(await screen.findByRole('tab', {name: 'Prioritized'})).toBeInTheDocument();
      expect(screen.getByRole('tab', {name: 'Prioritized'})).toHaveAttribute(
        'aria-selected',
        'true'
      );

      expect(defaultRouter.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            query: 'is:unresolved issue.priority:[high, medium]',
            viewId: 'default0',
            sort: IssueSortOptions.DATE,
          }),
        })
      );
    });

    it('allows you to manually enter a query, even if you only have a default tab', async () => {
      MockApiClient.clearMockResponses();
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/group-search-views/`,
        method: 'GET',
        body: [
          {
            name: 'Prioritized',
            query: 'is:unresolved issue.priority:[high, medium]',
            querySort: IssueSortOptions.DATE,
          },
        ],
      });

      render(<CustomViewsIssueListHeader {...defaultProps} router={queryOnlyRouter} />, {
        router: queryOnlyRouter,
      });

      expect(await screen.findByRole('tab', {name: 'Prioritized'})).toBeInTheDocument();
      expect(await screen.findByRole('tab', {name: 'Unsaved'})).toBeInTheDocument();
      expect(screen.getByRole('tab', {name: 'Unsaved'})).toHaveAttribute(
        'aria-selected',
        'true'
      );

      expect(queryOnlyRouter.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            query: 'is:unresolved',
            viewId: undefined,
          }),
        })
      );
    });

    it('initially selects a specific tab if its viewId is present in the url', async () => {
      const specificTabRouter = RouterFixture({
        location: LocationFixture({
          pathname: `/organizations/${organization.slug}/issues/`,
          query: {
            viewId: getRequestViews[1].id,
          },
        }),
      });

      render(
        <CustomViewsIssueListHeader {...defaultProps} router={specificTabRouter} />,
        {router: specificTabRouter}
      );

      expect(await screen.findByRole('tab', {name: 'Medium Priority'})).toHaveAttribute(
        'aria-selected',
        'true'
      );

      expect(specificTabRouter.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            viewId: getRequestViews[1].id,
            query: getRequestViews[1].query,
            sort: getRequestViews[1].querySort,
          }),
        })
      );
    });

    it('initially selects a temporary tab when only a query is present in the url', async () => {
      render(<CustomViewsIssueListHeader {...defaultProps} router={queryOnlyRouter} />, {
        router: queryOnlyRouter,
      });

      expect(await screen.findByRole('tab', {name: 'High Priority'})).toBeInTheDocument();
      expect(screen.getByRole('tab', {name: 'Medium Priority'})).toBeInTheDocument();
      expect(screen.getByRole('tab', {name: 'Low Priority'})).toBeInTheDocument();

      expect(screen.getByRole('tab', {name: 'Unsaved'})).toBeInTheDocument();

      expect(screen.getByRole('tab', {name: 'Unsaved'})).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(queryOnlyRouter.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            query: 'is:unresolved',
          }),
        })
      );
    });

    it('initially selects a temporary tab if a foreign viewId and a query is present in the url', async () => {
      const specificTabRouter = RouterFixture({
        location: LocationFixture({
          pathname: `/organizations/${organization.slug}/issues/`,
          query: {
            query: 'is:unresolved',
            viewId: 'randomViewIdThatDoesNotExist',
          },
        }),
      });
      render(
        <CustomViewsIssueListHeader {...defaultProps} router={specificTabRouter} />,
        {router: specificTabRouter}
      );

      expect(await screen.findByRole('tab', {name: 'High Priority'})).toBeInTheDocument();
      expect(screen.getByRole('tab', {name: 'Medium Priority'})).toBeInTheDocument();
      expect(screen.getByRole('tab', {name: 'Low Priority'})).toBeInTheDocument();

      expect(screen.getByRole('tab', {name: 'Unsaved'})).toBeInTheDocument();

      expect(screen.getByRole('tab', {name: 'Unsaved'})).toHaveAttribute(
        'aria-selected',
        'true'
      );
      // Make sure viewId is scrubbed from the url via a replace call
      expect(specificTabRouter.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            query: 'is:unresolved',
            viewId: undefined,
          }),
        })
      );
    });

    it('renders the unsaved changes indicator if a viewId and non-matching query are in the query params', async () => {
      const goodViewIdChangedQueryRouter = RouterFixture({
        location: LocationFixture({
          pathname: `/organizations/${organization.slug}/issues/`,
          query: {
            viewId: getRequestViews[1].id,
            query: 'is:unresolved',
          },
        }),
      });

      render(
        <CustomViewsIssueListHeader
          {...defaultProps}
          router={goodViewIdChangedQueryRouter}
        />,
        {router: goodViewIdChangedQueryRouter}
      );

      expect(await screen.findByRole('tab', {name: 'Medium Priority'})).toHaveAttribute(
        'aria-selected',
        'true'
      );

      expect(await screen.findByTestId('unsaved-changes-indicator')).toBeInTheDocument();

      expect(goodViewIdChangedQueryRouter.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            viewId: getRequestViews[1].id,
            query: 'is:unresolved',
            sort: getRequestViews[1].querySort,
          }),
        })
      );
    });

    it('renders the unsaved changes indicator if a viewId and non-matching sort are in the query params', async () => {
      const goodViewIdChangedSortRouter = RouterFixture({
        location: LocationFixture({
          pathname: `/organizations/${organization.slug}/issues/`,
          query: {
            viewId: getRequestViews[1].id,
            sort: IssueSortOptions.FREQ,
          },
        }),
      });

      render(
        <CustomViewsIssueListHeader
          {...defaultProps}
          router={goodViewIdChangedSortRouter}
        />,
        {router: goodViewIdChangedSortRouter}
      );

      expect(await screen.findByRole('tab', {name: 'Medium Priority'})).toHaveAttribute(
        'aria-selected',
        'true'
      );

      expect(await screen.findByTestId('unsaved-changes-indicator')).toBeInTheDocument();

      expect(goodViewIdChangedSortRouter.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            viewId: getRequestViews[1].id,
            query: getRequestViews[1].query,
            sort: IssueSortOptions.FREQ,
          }),
        })
      );
    });
  });

  describe('Tab ellipsis menu options', () => {
    beforeEach(() => {
      MockApiClient.clearMockResponses();
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/group-search-views/`,
        method: 'GET',
        body: getRequestViews,
      });
    });

    it('should render the correct set of actions for an unchanged tab', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/group-search-views/`,
        method: 'GET',
        body: getRequestViews,
      });

      render(<CustomViewsIssueListHeader {...defaultProps} />);

      userEvent.click(
        await screen.findByRole('button', {name: 'High Priority Ellipsis Menu'})
      );

      expect(
        screen.queryByRole('menuitemradio', {name: 'Save Changes'})
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('menuitemradio', {name: 'Discard Changes'})
      ).not.toBeInTheDocument();

      expect(
        await screen.findByRole('menuitemradio', {name: 'Rename'})
      ).toBeInTheDocument();
      expect(
        await screen.findByRole('menuitemradio', {name: 'Duplicate'})
      ).toBeInTheDocument();
      expect(
        await screen.findByRole('menuitemradio', {name: 'Delete'})
      ).toBeInTheDocument();
    });

    it('should render the correct set of actions for a changed tab', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/group-search-views/`,
        method: 'GET',
        body: getRequestViews,
      });

      render(<CustomViewsIssueListHeader {...defaultProps} router={unsavedTabRouter} />);

      userEvent.click(
        await screen.findByRole('button', {name: 'High Priority Ellipsis Menu'})
      );

      expect(
        await screen.findByRole('menuitemradio', {name: 'Save Changes'})
      ).toBeInTheDocument();
      expect(
        await screen.findByRole('menuitemradio', {name: 'Discard Changes'})
      ).toBeInTheDocument();
      expect(
        await screen.findByRole('menuitemradio', {name: 'Rename'})
      ).toBeInTheDocument();
      expect(
        await screen.findByRole('menuitemradio', {name: 'Duplicate'})
      ).toBeInTheDocument();
      expect(
        await screen.findByRole('menuitemradio', {name: 'Delete'})
      ).toBeInTheDocument();
    });

    it('should render the correct set of actions if only a single tab exists', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/group-search-views/`,
        method: 'GET',
        body: [getRequestViews[0]],
      });

      render(<CustomViewsIssueListHeader {...defaultProps} />);

      userEvent.click(
        await screen.findByRole('button', {name: 'High Priority Ellipsis Menu'})
      );

      expect(
        screen.queryByRole('menuitemradio', {name: 'Save Changes'})
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('menuitemradio', {name: 'Discard Changes'})
      ).not.toBeInTheDocument();

      expect(
        await screen.findByRole('menuitemradio', {name: 'Rename'})
      ).toBeInTheDocument();
      expect(
        await screen.findByRole('menuitemradio', {name: 'Duplicate'})
      ).toBeInTheDocument();

      // The delete action should be absent if only one tab exists
      expect(
        screen.queryByRole('menuitemradio', {name: 'Delete'})
      ).not.toBeInTheDocument();
    });
  });

  describe('Tab renaming', () => {});

  describe('Tab duplication', () => {});

  describe('Tab deletion', () => {});

  describe('Tab saving changes', () => {});

  describe('Tab discarding changes', () => {});
});
