import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {openAddToDashboardModal} from 'sentry/actionCreators/modal';
import type {NewQuery, Organization, SavedQuery} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {DisplayModes, SavedQueryDatasets} from 'sentry/utils/discover/types';
import {WidgetType} from 'sentry/views/dashboards/types';
import {getAllViews} from 'sentry/views/discover/data';
import SavedQueryButtonGroup from 'sentry/views/discover/savedQuery';
import * as utils from 'sentry/views/discover/savedQuery/utils';

jest.mock('sentry/actionCreators/modal');

function mount(
  location: ReturnType<typeof LocationFixture>,
  organization: Organization,
  router: ReturnType<typeof RouterFixture>,
  eventView: EventView,
  savedQuery: SavedQuery | NewQuery | undefined,
  yAxis: string[],
  disabled = false,
  setSavedQuery = jest.fn()
) {
  return render(
    <SavedQueryButtonGroup
      location={location}
      organization={organization}
      eventView={eventView}
      savedQuery={savedQuery as SavedQuery}
      disabled={disabled}
      updateCallback={() => {}}
      yAxis={yAxis}
      router={router}
      queryDataLoading={false}
      setSavedQuery={setSavedQuery}
      setHomepageQuery={jest.fn()}
    />
  );
}

describe('Discover > SaveQueryButtonGroup', function () {
  let organization: Organization;
  let errorsView: EventView;
  let savedQuery: SavedQuery;
  let errorsViewSaved: EventView;
  let errorsViewModified: EventView;
  let errorsQuery: NewQuery;
  const location = LocationFixture({
    pathname: '/organization/eventsv2/',
    query: {},
  });
  const router = RouterFixture({
    location: {query: {}},
  });
  const yAxis = ['count()', 'failure_count()'];

  beforeEach(() => {
    organization = OrganizationFixture({
      features: ['discover-query', 'dashboards-edit'],
    });

    errorsQuery = {
      ...(getAllViews(organization).find(
        view => view.name === 'Errors by Title'
      ) as NewQuery),
      yAxis: ['count()'],
      display: DisplayModes.DEFAULT,
    };
    errorsView = EventView.fromSavedQuery(errorsQuery);

    errorsViewSaved = EventView.fromSavedQuery(errorsQuery);
    errorsViewSaved.id = '1';

    errorsViewModified = EventView.fromSavedQuery(errorsQuery);
    errorsViewModified.id = '1';
    errorsViewModified.name = 'Modified Name';

    savedQuery = {
      ...errorsViewSaved.toNewQuery(),
      yAxis,
      dateCreated: '',
      dateUpdated: '',
      id: '1',
    };
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  describe('building on a new query', () => {
    const mockUtils = jest
      .spyOn(utils, 'handleCreateQuery')
      .mockImplementation(() => Promise.resolve(savedQuery));

    beforeEach(() => {
      mockUtils.mockClear();
    });

    it('renders disabled buttons when disabled prop is used', () => {
      mount(location, organization, router, errorsView, undefined, yAxis, true);

      expect(screen.getByRole('button', {name: /save as/i})).toBeDisabled();
    });

    it('renders the correct set of buttons', async () => {
      mount(location, organization, router, errorsView, undefined, yAxis);

      expect(screen.getByRole('button', {name: /save as/i})).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: /save changes/i})
      ).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', {name: /discover context menu/i}));
      expect(
        screen.queryByRole('menuitemradio', {name: /delete saved query/i})
      ).not.toBeInTheDocument();
    });

    it('renders the correct set of buttons with the homepage query feature', async () => {
      organization = OrganizationFixture({
        features: ['discover-query', 'dashboards-edit'],
      });
      mount(location, organization, router, errorsView, undefined, yAxis);

      expect(screen.getByRole('button', {name: /save as/i})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: /set as default/i})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: /saved queries/i})).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: /discover context menu/i})
      ).toBeInTheDocument();

      expect(
        screen.queryByRole('button', {name: /save changes/i})
      ).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: /discover context menu/i}));
      expect(
        screen.getByRole('menuitemradio', {name: /add to dashboard/i})
      ).toBeInTheDocument();
    });

    it('opens dashboard modal with the right props', async () => {
      organization = OrganizationFixture({
        features: [
          'discover-query',
          'dashboards-edit',
          'performance-discover-dataset-selector',
        ],
      });
      mount(
        location,
        organization,
        router,
        errorsView,
        {...savedQuery, queryDataset: SavedQueryDatasets.ERRORS},
        yAxis
      );

      expect(
        screen.getByRole('button', {name: /discover context menu/i})
      ).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: /discover context menu/i}));
      expect(
        screen.getByRole('menuitemradio', {name: /add to dashboard/i})
      ).toBeInTheDocument();
      await userEvent.click(
        screen.getByRole('menuitemradio', {name: /add to dashboard/i})
      );

      expect(openAddToDashboardModal).toHaveBeenCalledWith(
        expect.objectContaining({
          widget: {
            displayType: 'line',
            interval: undefined,
            limit: undefined,
            queries: [
              {
                aggregates: ['count()', 'failure_count()'],
                columns: [],
                conditions: 'event.type:error',
                fields: ['count()', 'failure_count()'],
                name: '',
                orderby: '-count()',
              },
            ],
            title: 'Errors by Title',
            widgetType: WidgetType.ERRORS,
          },
          widgetAsQueryParams: expect.objectContaining({
            dataset: WidgetType.ERRORS,
            defaultTableColumns: ['title', 'count()', 'count_unique(user)', 'project'],
            defaultTitle: 'Errors by Title',
            defaultWidgetQuery:
              'name=&aggregates=count()%2Cfailure_count()&columns=&fields=count()%2Cfailure_count()&conditions=event.type%3Aerror&orderby=-count()',
            displayType: 'line',
            end: undefined,
            limit: undefined,
            source: 'discoverv2',
            start: undefined,
            statsPeriod: '24h',
          }),
        })
      );
    });

    it('hides the banner when save is complete.', async () => {
      mount(location, organization, router, errorsView, undefined, yAxis);

      // Click on ButtonSaveAs to open dropdown
      await userEvent.click(screen.getByRole('button', {name: 'Save as'}));

      // Fill in the Input
      await userEvent.type(
        screen.getByPlaceholderText('Display name'),
        'My New Query Name'
      );

      // Click on Save in the Dropdown
      await userEvent.click(screen.getByRole('button', {name: 'Save for Org'}));

      // The banner should not render
      expect(screen.queryByText('Discover Trends')).not.toBeInTheDocument();
    });

    it('saves a well-formed query', async () => {
      mount(location, organization, router, errorsView, undefined, yAxis);

      // Click on ButtonSaveAs to open dropdown
      await userEvent.click(screen.getByRole('button', {name: 'Save as'}));

      // Fill in the Input
      await userEvent.type(
        screen.getByPlaceholderText('Display name'),
        'My New Query Name'
      );

      // Click on Save in the Dropdown
      await userEvent.click(screen.getByRole('button', {name: 'Save for Org'}));

      expect(mockUtils).toHaveBeenCalledWith(
        expect.anything(), // api
        organization,
        expect.objectContaining({
          ...errorsView,
          name: 'My New Query Name',
        }),
        yAxis,
        true
      );
    });

    it('rejects if query.name is empty', async () => {
      mount(location, organization, router, errorsView, undefined, yAxis);

      // Click on ButtonSaveAs to open dropdown
      await userEvent.click(screen.getByRole('button', {name: 'Save as'}));

      // Do not fill in Input

      // Click on Save in the Dropdown
      await userEvent.click(screen.getByRole('button', {name: 'Save for Org'}));

      // Check that EventView has a name
      expect(errorsView.name).toBe('Errors by Title');

      expect(mockUtils).not.toHaveBeenCalled();
    });
  });

  describe('viewing a saved query', () => {
    let mockUtils: jest.SpyInstance;

    beforeEach(() => {
      mockUtils = jest
        .spyOn(utils, 'handleDeleteQuery')
        .mockImplementation(() => Promise.resolve());
    });

    afterEach(() => {
      mockUtils.mockClear();
    });

    it('renders the correct set of buttons', async () => {
      mount(
        location,
        organization,
        router,
        EventView.fromSavedQuery({...errorsQuery, yAxis}),
        savedQuery,
        yAxis
      );

      expect(screen.queryByRole('button', {name: /save as/i})).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: /save changes/i})
      ).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: /discover context menu/i}));
      expect(
        screen.getByRole('menuitemradio', {name: /delete saved query/i})
      ).toBeInTheDocument();
    });

    it('treats undefined yAxis the same as count() when checking for changes', async () => {
      mount(
        location,
        organization,
        router,
        errorsViewSaved,
        {...savedQuery, yAxis: undefined},
        ['count()']
      );

      expect(screen.queryByRole('button', {name: /save as/i})).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: /save changes/i})
      ).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', {name: /discover context menu/i}));
      expect(
        screen.getByRole('menuitemradio', {name: /delete saved query/i})
      ).toBeInTheDocument();
    });

    it('converts string yAxis values to array when checking for changes', async () => {
      mount(
        location,
        organization,
        router,
        errorsViewSaved,
        {...savedQuery, yAxis: ['count()']},
        ['count()']
      );

      expect(screen.queryByRole('button', {name: /save as/i})).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: /save changes/i})
      ).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', {name: /discover context menu/i}));
      expect(
        screen.getByRole('menuitemradio', {name: /delete saved query/i})
      ).toBeInTheDocument();
    });

    it('deletes the saved query', async () => {
      mount(location, organization, router, errorsViewSaved, savedQuery, yAxis);

      await userEvent.click(screen.getByRole('button', {name: /discover context menu/i}));
      await userEvent.click(
        screen.getByRole('menuitemradio', {name: /delete saved query/i})
      );

      expect(mockUtils).toHaveBeenCalledWith(
        expect.anything(), // api
        organization,
        expect.objectContaining({id: '1'})
      );
    });
  });

  describe('modifying a saved query', () => {
    let mockUtils: jest.SpyInstance;

    it('renders the correct set of buttons', async () => {
      mount(
        location,
        organization,
        router,
        errorsViewModified,
        errorsViewSaved.toNewQuery(),
        yAxis
      );

      expect(screen.getByRole('button', {name: /save as/i})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: /save changes/i})).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: /discover context menu/i}));
      expect(
        screen.getByRole('menuitemradio', {name: /delete saved query/i})
      ).toBeInTheDocument();
    });

    describe('updates the saved query', () => {
      beforeEach(() => {
        mockUtils = jest
          .spyOn(utils, 'handleUpdateQuery')
          .mockImplementation(() => Promise.resolve(savedQuery));
      });

      afterEach(() => {
        mockUtils.mockClear();
      });

      it('accepts a well-formed query', async () => {
        const mockSetSavedQuery = jest.fn();
        mount(
          location,
          organization,
          router,
          errorsViewModified,
          savedQuery,
          yAxis,
          false,
          mockSetSavedQuery
        );

        // Click on Save in the Dropdown
        await userEvent.click(screen.getByRole('button', {name: /save changes/i}));

        await waitFor(() => {
          expect(mockUtils).toHaveBeenCalledWith(
            expect.anything(), // api
            organization,
            expect.objectContaining({
              ...errorsViewModified,
            }),
            yAxis
          );
        });
        expect(mockSetSavedQuery).toHaveBeenCalled();
      });
    });

    describe('creates a separate query', () => {
      beforeEach(() => {
        mockUtils = jest
          .spyOn(utils, 'handleCreateQuery')
          .mockImplementation(() => Promise.resolve(savedQuery));
      });

      afterEach(() => {
        mockUtils.mockClear();
      });

      it('checks that it is forked from a saved query', async () => {
        mount(location, organization, router, errorsViewModified, savedQuery, yAxis);

        // Click on ButtonSaveAs to open dropdown
        await userEvent.click(screen.getByRole('button', {name: 'Save as'}));

        // Fill in the Input
        await userEvent.type(screen.getByPlaceholderText('Display name'), 'Forked Query');

        // Click on Save in the Dropdown
        await userEvent.click(screen.getByRole('button', {name: 'Save for Org'}));

        expect(mockUtils).toHaveBeenCalledWith(
          expect.anything(), // api
          organization,
          expect.objectContaining({
            ...errorsViewModified,
            name: 'Forked Query',
          }),
          yAxis,
          false
        );
      });
    });
  });
  describe('create alert from discover', () => {
    it('renders create alert button when metrics alerts is enabled', () => {
      const metricAlertOrg = {
        ...organization,
        features: ['incidents'],
      };
      mount(location, metricAlertOrg, router, errorsViewModified, savedQuery, yAxis);

      expect(screen.getByRole('button', {name: /create alert/i})).toBeInTheDocument();
    });
    it('does not render create alert button without metric alerts', () => {
      mount(location, organization, router, errorsViewModified, savedQuery, yAxis);

      expect(
        screen.queryByRole('button', {name: /create alert/i})
      ).not.toBeInTheDocument();
    });
    it('uses the throughput alert type for transaction queries', () => {
      const metricAlertOrg = {
        ...organization,
        features: ['incidents', 'performance-discover-dataset-selector'],
      };
      const transactionSavedQuery = {
        ...savedQuery,
        queryDataset: SavedQueryDatasets.TRANSACTIONS,
        query: 'foo:bar',
      };
      const transactionView = EventView.fromSavedQuery(transactionSavedQuery);
      mount(
        location,
        metricAlertOrg,
        router,
        transactionView,
        transactionSavedQuery,
        yAxis
      );

      const createAlertButton = screen.getByRole('button', {name: /create alert/i});
      const href = createAlertButton.getAttribute('href')!;
      const queryParameters = new URLSearchParams(href.split('?')[1]);

      expect(queryParameters.get('query')).toEqual(
        '(foo:bar) AND (event.type:transaction)'
      );
      expect(queryParameters.get('dataset')).toEqual('transactions');
      expect(queryParameters.get('eventTypes')).toEqual('transaction');
    });
    it('uses the num errors alert type for error queries', () => {
      const metricAlertOrg = {
        ...organization,
        features: ['incidents', 'performance-discover-dataset-selector'],
      };
      const errorSavedQuery = {
        ...savedQuery,
        queryDataset: SavedQueryDatasets.ERRORS,
        query: 'foo:bar',
      };
      const transactionView = EventView.fromSavedQuery(errorSavedQuery);
      mount(location, metricAlertOrg, router, transactionView, errorSavedQuery, yAxis);

      const createAlertButton = screen.getByRole('button', {name: /create alert/i});
      const href = createAlertButton.getAttribute('href')!;
      const queryParameters = new URLSearchParams(href.split('?')[1]);

      expect(queryParameters.get('query')).toEqual('foo:bar');
      expect(queryParameters.get('dataset')).toEqual('events');
      expect(queryParameters.get('eventTypes')).toEqual('error');
    });
  });
});
