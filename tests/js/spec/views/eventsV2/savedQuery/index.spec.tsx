import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  openAddDashboardWidgetModal,
  openAddToDashboardModal,
} from 'sentry/actionCreators/modal';
import {NewQuery} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {DisplayModes} from 'sentry/utils/discover/types';
import {DashboardWidgetSource, DisplayType} from 'sentry/views/dashboardsV2/types';
import DiscoverBanner from 'sentry/views/eventsV2/banner';
import {ALL_VIEWS} from 'sentry/views/eventsV2/data';
import SavedQueryButtonGroup from 'sentry/views/eventsV2/savedQuery';
import * as utils from 'sentry/views/eventsV2/savedQuery/utils';

const SELECTOR_BUTTON_SAVE_AS = 'button[aria-label="Save as"]';
const SELECTOR_BUTTON_SAVED = '[data-test-id="discover2-savedquery-button-saved"]';
const SELECTOR_BUTTON_UPDATE = '[data-test-id="discover2-savedquery-button-update"]';
const SELECTOR_BUTTON_DELETE = '[data-test-id="discover2-savedquery-button-delete"]';
const SELECTOR_BUTTON_CREATE_ALERT = '[data-test-id="discover2-create-from-discover"]';

jest.mock('sentry/actionCreators/modal');

function mount(
  location,
  organization,
  router,
  eventView,
  savedQuery,
  yAxis,
  disabled = false
) {
  return render(
    <SavedQueryButtonGroup
      location={location}
      organization={organization}
      eventView={eventView}
      savedQuery={savedQuery}
      disabled={disabled}
      updateCallback={() => {}}
      yAxis={yAxis}
      onIncompatibleAlertQuery={() => undefined}
      router={router}
      savedQueryLoading={false}
    />
  );
}
function generateWrappedComponent(
  location,
  organization,
  router,
  eventView,
  savedQuery,
  yAxis,
  disabled = false
) {
  return mountWithTheme(
    <SavedQueryButtonGroup
      location={location}
      organization={organization}
      eventView={eventView}
      savedQuery={savedQuery}
      disabled={disabled}
      updateCallback={() => {}}
      yAxis={yAxis}
      onIncompatibleAlertQuery={() => undefined}
      router={router}
      savedQueryLoading={false}
    />
  );
}

describe('EventsV2 > SaveQueryButtonGroup', function () {
  const organization = TestStubs.Organization({
    features: ['discover-query', 'dashboards-edit'],
  });
  const location = {
    pathname: '/organization/eventsv2/',
    query: {},
  };
  const router = {
    location: {query: {}},
  };
  const yAxis = ['count()', 'failure_count()'];

  const errorsQuery = {
    ...(ALL_VIEWS.find(view => view.name === 'Errors by Title') as NewQuery),
    yAxis: ['count()'],
    display: DisplayModes.DEFAULT,
  };
  const errorsView = EventView.fromSavedQuery(errorsQuery);

  const errorsViewSaved = EventView.fromSavedQuery(errorsQuery);
  errorsViewSaved.id = '1';

  const errorsViewModified = EventView.fromSavedQuery(errorsQuery);
  errorsViewModified.id = '1';
  errorsViewModified.name = 'Modified Name';

  const savedQuery = {
    ...errorsViewSaved.toNewQuery(),
    yAxis,
    dateCreated: '',
    dateUpdated: '',
    id: '1',
  };

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
      const wrapper = generateWrappedComponent(
        location,
        organization,
        router,
        errorsView,
        undefined,
        yAxis,
        true
      );

      const buttonSaveAs = wrapper.find(SELECTOR_BUTTON_SAVE_AS);
      expect(buttonSaveAs.props()['aria-disabled']).toBe(true);
    });

    it('renders the correct set of buttons', () => {
      const wrapper = generateWrappedComponent(
        location,
        organization,
        router,
        errorsView,
        undefined,
        yAxis
      );

      const buttonSaveAs = wrapper.find(SELECTOR_BUTTON_SAVE_AS);
      const buttonSaved = wrapper.find(SELECTOR_BUTTON_SAVED);
      const buttonUpdate = wrapper.find(SELECTOR_BUTTON_UPDATE);
      const buttonDelete = wrapper.find(SELECTOR_BUTTON_DELETE);

      expect(buttonSaveAs.exists()).toBe(true);
      expect(buttonSaved.exists()).toBe(false);
      expect(buttonUpdate.exists()).toBe(false);
      expect(buttonDelete.exists()).toBe(false);
    });

    it('hides the banner when save is complete.', async () => {
      const wrapper = generateWrappedComponent(
        location,
        organization,
        router,
        errorsView,
        undefined,
        yAxis
      );

      // Click on ButtonSaveAs to open dropdown
      const buttonSaveAs = wrapper.find('DropdownControl').first();
      buttonSaveAs.simulate('click');

      // Fill in the Input
      buttonSaveAs
        .find('ButtonSaveInput')
        .simulate('change', {target: {value: 'My New Query Name'}}); // currentTarget.value does not work
      await tick();

      // Click on Save in the Dropdown
      await buttonSaveAs.find('ButtonSaveDropDown Button').simulate('click');

      // The banner should not render
      const banner = mountWithTheme(
        <DiscoverBanner organization={organization} resultsUrl="" />
      );
      expect(banner.find('BannerTitle').exists()).toBe(false);
    });

    it('saves a well-formed query', async () => {
      const wrapper = generateWrappedComponent(
        location,
        organization,
        router,
        errorsView,
        undefined,
        yAxis
      );

      // Click on ButtonSaveAs to open dropdown
      const buttonSaveAs = wrapper.find('DropdownControl').first();
      buttonSaveAs.simulate('click');

      // Fill in the Input
      buttonSaveAs
        .find('ButtonSaveInput')
        .simulate('change', {target: {value: 'My New Query Name'}}); // currentTarget.value does not work
      await tick();

      // Click on Save in the Dropdown
      await buttonSaveAs.find('ButtonSaveDropDown Button').simulate('click');

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
      const wrapper = generateWrappedComponent(
        location,
        organization,
        router,
        errorsView,
        undefined,
        yAxis
      );

      // Click on ButtonSaveAs to open dropdown
      const buttonSaveAs = wrapper.find('DropdownControl').first();
      buttonSaveAs.simulate('click');

      // Do not fill in Input
      await tick();

      // Click on Save in the Dropdown
      buttonSaveAs.find('ButtonSaveDropDown Button').simulate('click');

      // Check that EventView has a name
      expect(errorsView.name).toBe('Errors by Title');

      expect(mockUtils).not.toHaveBeenCalled();
    });
  });

  describe('viewing a saved query', () => {
    let mockUtils;

    beforeEach(() => {
      mockUtils = jest
        .spyOn(utils, 'handleDeleteQuery')
        .mockImplementation(() => Promise.resolve());
    });

    afterEach(() => {
      mockUtils.mockClear();
    });

    it('renders the correct set of buttons', () => {
      const wrapper = generateWrappedComponent(
        location,
        organization,
        router,
        errorsViewSaved,
        savedQuery,
        yAxis
      );

      const buttonSaveAs = wrapper.find(SELECTOR_BUTTON_SAVE_AS);
      const buttonSaved = wrapper.find(SELECTOR_BUTTON_SAVED);
      const buttonUpdate = wrapper.find(SELECTOR_BUTTON_UPDATE);
      const buttonDelete = wrapper.find(SELECTOR_BUTTON_DELETE);

      expect(buttonSaveAs.exists()).toBe(false);
      expect(buttonSaved.exists()).toBe(true);
      expect(buttonUpdate.exists()).toBe(false);
      expect(buttonDelete.exists()).toBe(true);
    });

    it('treats undefined yAxis the same as count() when checking for changes', () => {
      const wrapper = generateWrappedComponent(
        location,
        organization,
        router,
        errorsViewSaved,
        {...savedQuery, yAxis: undefined},
        ['count()']
      );

      const buttonSaveAs = wrapper.find(SELECTOR_BUTTON_SAVE_AS);
      const buttonSaved = wrapper.find(SELECTOR_BUTTON_SAVED);
      const buttonUpdate = wrapper.find(SELECTOR_BUTTON_UPDATE);
      const buttonDelete = wrapper.find(SELECTOR_BUTTON_DELETE);

      expect(buttonSaveAs.exists()).toBe(false);
      expect(buttonSaved.exists()).toBe(true);
      expect(buttonUpdate.exists()).toBe(false);
      expect(buttonDelete.exists()).toBe(true);
    });

    it('converts string yAxis values to array when checking for changes', () => {
      const wrapper = generateWrappedComponent(
        location,
        organization,
        router,
        errorsViewSaved,
        {...savedQuery, yAxis: 'count()'},
        ['count()']
      );

      const buttonSaveAs = wrapper.find(SELECTOR_BUTTON_SAVE_AS);
      const buttonSaved = wrapper.find(SELECTOR_BUTTON_SAVED);
      const buttonUpdate = wrapper.find(SELECTOR_BUTTON_UPDATE);
      const buttonDelete = wrapper.find(SELECTOR_BUTTON_DELETE);

      expect(buttonSaveAs.exists()).toBe(false);
      expect(buttonSaved.exists()).toBe(true);
      expect(buttonUpdate.exists()).toBe(false);
      expect(buttonDelete.exists()).toBe(true);
    });

    it('deletes the saved query', async () => {
      const wrapper = generateWrappedComponent(
        location,
        organization,
        router,
        errorsViewSaved,
        savedQuery,
        yAxis
      );

      const buttonDelete = wrapper.find(SELECTOR_BUTTON_DELETE).first();
      await buttonDelete.simulate('click');

      expect(mockUtils).toHaveBeenCalledWith(
        expect.anything(), // api
        organization,
        expect.objectContaining({id: '1'})
      );
    });

    it('opens a modal with the correct params for top 5 display mode', async function () {
      const featuredOrganization = TestStubs.Organization({
        features: ['dashboards-edit', 'new-widget-builder-experience-design'],
      });
      const testData = initializeOrg({
        ...initializeOrg(),
        organization: featuredOrganization,
      });
      const savedTopNQuery = TestStubs.DiscoverSavedQuery({
        display: DisplayModes.TOP5,
        orderby: 'test',
        fields: ['test', 'count()'],
        topEvents: '2',
      });
      mount(
        testData.router.location,
        testData.organization,
        testData.router,
        EventView.fromSavedQuery(savedTopNQuery),
        savedTopNQuery,
        ['count()']
      );
      userEvent.click(screen.getByText('Add to Dashboard'));
      expect(openAddDashboardWidgetModal).not.toHaveBeenCalled();

      await waitFor(() => {
        expect(openAddToDashboardModal).toHaveBeenCalledWith(
          expect.objectContaining({
            widget: {
              title: 'Saved query #1',
              displayType: DisplayType.AREA,
              limit: 2,
              queries: [
                {
                  aggregates: ['count()'],
                  columns: ['test'],
                  conditions: '',
                  fields: ['test', 'count()', 'count()'],
                  name: '',
                  orderby: 'test',
                },
              ],
            },
            widgetAsQueryParams: expect.objectContaining({
              defaultTableColumns: ['test', 'count()'],
              defaultTitle: 'Saved query #1',
              defaultWidgetQuery:
                'name=&aggregates=count()&columns=test&fields=test%2Ccount()%2Ccount()&conditions=&orderby=test',
              displayType: DisplayType.AREA,
              source: DashboardWidgetSource.DISCOVERV2,
            }),
          })
        );
      });
    });

    it('opens a modal with the correct params for default display mode', async function () {
      const featuredOrganization = TestStubs.Organization({
        features: ['dashboards-edit', 'new-widget-builder-experience-design'],
      });
      const testData = initializeOrg({
        ...initializeOrg(),
        organization: featuredOrganization,
      });
      const savedDefaultQuery = TestStubs.DiscoverSavedQuery({
        display: DisplayModes.DEFAULT,
        orderby: 'count()',
        fields: ['test', 'count()'],
        yAxis: ['count()'],
      });
      mount(
        testData.router.location,
        testData.organization,
        testData.router,
        EventView.fromSavedQuery(savedDefaultQuery),
        savedDefaultQuery,
        ['count()']
      );
      userEvent.click(screen.getByText('Add to Dashboard'));
      expect(openAddDashboardWidgetModal).not.toHaveBeenCalled();

      await waitFor(() => {
        expect(openAddToDashboardModal).toHaveBeenCalledWith(
          expect.objectContaining({
            widget: {
              title: 'Saved query #1',
              displayType: DisplayType.LINE,
              queries: [
                {
                  aggregates: ['count()'],
                  columns: [],
                  conditions: '',
                  fields: ['count()'],
                  name: '',
                  // Orderby gets dropped because ordering only applies to
                  // Top-N and tables
                  orderby: '',
                },
              ],
            },
            widgetAsQueryParams: expect.objectContaining({
              defaultTableColumns: ['test', 'count()'],
              defaultTitle: 'Saved query #1',
              defaultWidgetQuery:
                'name=&aggregates=count()&columns=&fields=count()&conditions=&orderby=',
              displayType: DisplayType.LINE,
              source: DashboardWidgetSource.DISCOVERV2,
            }),
          })
        );
      });
    });
  });

  describe('modifying a saved query', () => {
    let mockUtils;

    it('renders the correct set of buttons', () => {
      const wrapper = generateWrappedComponent(
        location,
        organization,
        router,
        errorsViewModified,
        errorsViewSaved.toNewQuery(),
        yAxis
      );

      const buttonSaveAs = wrapper.find(SELECTOR_BUTTON_SAVE_AS);
      const buttonSaved = wrapper.find(SELECTOR_BUTTON_SAVED);
      const buttonUpdate = wrapper.find(SELECTOR_BUTTON_UPDATE);
      const buttonDelete = wrapper.find(SELECTOR_BUTTON_DELETE);

      expect(buttonSaveAs.exists()).toBe(true);
      expect(buttonSaved.exists()).toBe(false);
      expect(buttonUpdate.exists()).toBe(true);
      expect(buttonDelete.exists()).toBe(true);
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
        const wrapper = generateWrappedComponent(
          location,
          organization,
          router,
          errorsViewModified,
          savedQuery,
          yAxis
        );

        // Click on Save in the Dropdown
        const buttonUpdate = wrapper.find(SELECTOR_BUTTON_UPDATE).first();
        await buttonUpdate.simulate('click');

        expect(mockUtils).toHaveBeenCalledWith(
          expect.anything(), // api
          organization,
          expect.objectContaining({
            ...errorsViewModified,
          }),
          yAxis
        );
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
        const wrapper = generateWrappedComponent(
          location,
          organization,
          router,
          errorsViewModified,
          savedQuery,
          yAxis
        );

        // Click on ButtonSaveAs to open dropdown
        const buttonSaveAs = wrapper.find('DropdownControl').first();
        buttonSaveAs.simulate('click');

        // Fill in the Input
        buttonSaveAs
          .find('ButtonSaveInput')
          .simulate('change', {target: {value: 'Forked Query'}});
        await tick();

        // Click on Save in the Dropdown
        await buttonSaveAs.find('ButtonSaveDropDown Button').simulate('click');

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
      const wrapper = generateWrappedComponent(
        location,
        metricAlertOrg,
        router,
        errorsViewModified,
        savedQuery,
        yAxis
      );
      const buttonCreateAlert = wrapper.find(SELECTOR_BUTTON_CREATE_ALERT);

      expect(buttonCreateAlert.exists()).toBe(true);
    });
    it('does not render create alert button without metric alerts', () => {
      const wrapper = generateWrappedComponent(
        location,
        organization,
        router,
        errorsViewModified,
        savedQuery,
        yAxis
      );
      const buttonCreateAlert = wrapper.find(SELECTOR_BUTTON_CREATE_ALERT);

      expect(buttonCreateAlert.exists()).toBe(false);
    });
  });

  describe('add dashboard widget', () => {
    let initialData;
    beforeEach(() => {
      initialData = initializeOrg({
        organization: {
          features: ['discover-query', 'widget-viewer-modal', 'dashboards-edit'],
          apdexThreshold: 400,
        },
        router: {
          location: {query: {}},
        },
        project: 1,
        projects: [],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-stats/',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/',
        body: [],
      });
    });

    afterEach(() => {
      MockApiClient.clearMockResponses();
    });

    it('opens widget modal when add to dashboard is clicked', async () => {
      mount(
        initialData.router.location,
        initialData.organization,
        initialData.router,
        errorsViewModified,
        savedQuery,
        ['count()']
      );
      userEvent.click(screen.getByText('Add to Dashboard'));
      expect(openAddDashboardWidgetModal).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultTableColumns: ['title', 'count()', 'count_unique(user)', 'project'],
          defaultTitle: 'Errors by Title',
          defaultWidgetQuery: {
            conditions: 'event.type:error',
            fields: ['count()'],
            aggregates: ['count()'],
            columns: [],
            name: '',
            orderby: '-count()',
          },
          displayType: 'line',
        })
      );
    });

    it('populates dashboard widget modal with saved query data if created from discover', async () => {
      mount(
        initialData.router.location,
        initialData.organization,
        initialData.router,
        errorsViewModified,
        savedQuery,
        yAxis
      );
      userEvent.click(screen.getByText('Add to Dashboard'));
      expect(openAddDashboardWidgetModal).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultTableColumns: ['title', 'count()', 'count_unique(user)', 'project'],
          defaultTitle: 'Errors by Title',
          defaultWidgetQuery: {
            conditions: 'event.type:error',
            fields: ['count()', 'failure_count()'],
            aggregates: ['count()', 'failure_count()'],
            columns: [],
            name: '',
            orderby: '-count()',
          },
          displayType: 'line',
        })
      );
    });

    it('adds equation to query fields if yAxis includes comprising functions', async () => {
      mount(
        initialData.router.location,
        initialData.organization,
        initialData.router,
        errorsViewModified,
        savedQuery,
        [...yAxis, 'equation|count() + failure_count()']
      );
      userEvent.click(screen.getByText('Add to Dashboard'));
      expect(openAddDashboardWidgetModal).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultTableColumns: ['title', 'count()', 'count_unique(user)', 'project'],
          defaultTitle: 'Errors by Title',
          defaultWidgetQuery: {
            conditions: 'event.type:error',
            fields: ['count()', 'failure_count()', 'equation|count() + failure_count()'],
            aggregates: [
              'count()',
              'failure_count()',
              'equation|count() + failure_count()',
            ],
            columns: [],
            name: '',
            orderby: '-count()',
          },
          displayType: 'line',
        })
      );
    });
  });
});
