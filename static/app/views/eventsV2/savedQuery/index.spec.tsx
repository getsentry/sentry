import {mountWithTheme} from 'sentry-test/enzyme';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {NewQuery} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {DisplayModes} from 'sentry/utils/discover/types';
import DiscoverBanner from 'sentry/views/eventsV2/banner';
import {ALL_VIEWS} from 'sentry/views/eventsV2/data';
import SavedQueryButtonGroup from 'sentry/views/eventsV2/savedQuery';
import * as utils from 'sentry/views/eventsV2/savedQuery/utils';

const SELECTOR_BUTTON_SAVE_AS = 'button[aria-label="Save as"]';
const SELECTOR_BUTTON_SET_AS_DEFAULT = '[data-test-id="set-as-default"]';
const SELECTOR_BUTTON_SAVED = '[data-test-id="discover2-savedquery-button-saved"]';
const SELECTOR_BUTTON_UPDATE = '[data-test-id="discover2-savedquery-button-update"]';
const SELECTOR_BUTTON_DELETE = '[data-test-id="discover2-savedquery-button-delete"]';
const SELECTOR_BUTTON_CREATE_ALERT = '[data-test-id="discover2-create-from-discover"]';
const SELECTOR_SAVED_QUERIES = '[data-test-id="discover2-savedquery-button-view-saved"]';
const SELECTOR_CONTEXT_MENU = 'button[aria-label="Discover Context Menu"]';
const SELECTOR_ADD_TO_DASHBAORD = 'button[aria-label="Add to Dashboard"]';

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
      router={router}
      queryDataLoading={false}
      setSavedQuery={jest.fn()}
      setHomepageQuery={jest.fn()}
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
  const mockSetSavedQuery = jest.fn();
  return {
    mockSetSavedQuery,
    wrapper: mountWithTheme(
      <SavedQueryButtonGroup
        location={location}
        organization={organization}
        eventView={eventView}
        savedQuery={savedQuery}
        disabled={disabled}
        updateCallback={() => {}}
        yAxis={yAxis}
        router={router}
        queryDataLoading={false}
        setSavedQuery={mockSetSavedQuery}
        setHomepageQuery={jest.fn()}
      />
    ),
  };
}

describe('EventsV2 > SaveQueryButtonGroup', function () {
  let organization;
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

  beforeEach(() => {
    organization = TestStubs.Organization({
      features: ['discover-query', 'dashboards-edit'],
    });
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
      const {wrapper} = generateWrappedComponent(
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
      const {wrapper} = generateWrappedComponent(
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

    it('renders the correct set of buttons with the homepage query feature', () => {
      organization = TestStubs.Organization({
        features: [
          'discover-query',
          'dashboards-edit',
          'discover-query-builder-as-landing-page',
        ],
      });
      const {wrapper} = generateWrappedComponent(
        location,
        organization,
        router,
        errorsView,
        undefined,
        yAxis
      );

      const buttonSetAsDefault = wrapper.find(SELECTOR_BUTTON_SET_AS_DEFAULT);
      const buttonSaveAs = wrapper.find(SELECTOR_BUTTON_SAVE_AS);
      const buttonSaved = wrapper.find(SELECTOR_BUTTON_SAVED);
      const buttonUpdate = wrapper.find(SELECTOR_BUTTON_UPDATE);
      const buttonDelete = wrapper.find(SELECTOR_BUTTON_DELETE);
      const buttonSavedQueries = wrapper.find(SELECTOR_SAVED_QUERIES);
      const buttonContextMenu = wrapper.find(SELECTOR_CONTEXT_MENU);
      const buttonAddToDashboard = wrapper.find(SELECTOR_ADD_TO_DASHBAORD);

      expect(buttonSetAsDefault.exists()).toBe(true);
      expect(buttonSaveAs.exists()).toBe(true);
      expect(buttonSavedQueries.exists()).toBe(true);
      expect(buttonContextMenu.exists()).toBe(true);

      expect(buttonSaved.exists()).toBe(false);
      expect(buttonUpdate.exists()).toBe(false);
      expect(buttonDelete.exists()).toBe(false);
      expect(buttonAddToDashboard.exists()).toBe(false);
    });

    it('hides the banner when save is complete.', () => {
      mount(location, organization, router, errorsView, undefined, yAxis);

      // Click on ButtonSaveAs to open dropdown
      userEvent.click(screen.getByRole('button', {name: 'Save as'}));

      // Fill in the Input
      userEvent.type(screen.getByPlaceholderText('Display name'), 'My New Query Name');

      // Click on Save in the Dropdown
      userEvent.click(screen.getByRole('button', {name: 'Save for Org'}));

      // The banner should not render
      mountWithTheme(<DiscoverBanner organization={organization} resultsUrl="" />);
      expect(screen.queryByText('Discover Trends')).not.toBeInTheDocument();
    });

    it('saves a well-formed query', () => {
      mount(location, organization, router, errorsView, undefined, yAxis);

      // Click on ButtonSaveAs to open dropdown
      userEvent.click(screen.getByRole('button', {name: 'Save as'}));

      // Fill in the Input
      userEvent.type(screen.getByPlaceholderText('Display name'), 'My New Query Name');

      // Click on Save in the Dropdown
      userEvent.click(screen.getByRole('button', {name: 'Save for Org'}));

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

    it('rejects if query.name is empty', () => {
      mount(location, organization, router, errorsView, undefined, yAxis);

      // Click on ButtonSaveAs to open dropdown
      userEvent.click(screen.getByRole('button', {name: 'Save as'}));

      // Do not fill in Input

      // Click on Save in the Dropdown
      userEvent.click(screen.getByRole('button', {name: 'Save for Org'}));

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
      const {wrapper} = generateWrappedComponent(
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
      const {wrapper} = generateWrappedComponent(
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
      const {wrapper} = generateWrappedComponent(
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
      const {wrapper} = generateWrappedComponent(
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
  });

  describe('modifying a saved query', () => {
    let mockUtils;

    it('renders the correct set of buttons', () => {
      const {wrapper} = generateWrappedComponent(
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
        const {mockSetSavedQuery, wrapper} = generateWrappedComponent(
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

      it('checks that it is forked from a saved query', () => {
        mount(location, organization, router, errorsViewModified, savedQuery, yAxis);

        // Click on ButtonSaveAs to open dropdown
        userEvent.click(screen.getByRole('button', {name: 'Save as'}));

        // Fill in the Input
        userEvent.type(screen.getByPlaceholderText('Display name'), 'Forked Query');

        // Click on Save in the Dropdown
        userEvent.click(screen.getByRole('button', {name: 'Save for Org'}));

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
      const {wrapper} = generateWrappedComponent(
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
      const {wrapper} = generateWrappedComponent(
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
});
