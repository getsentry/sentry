import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {NewQuery} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {DisplayModes} from 'sentry/utils/discover/types';
import {ALL_VIEWS} from 'sentry/views/eventsV2/data';
import SavedQueryButtonGroup from 'sentry/views/eventsV2/savedQuery';
import * as utils from 'sentry/views/eventsV2/savedQuery/utils';

jest.mock('sentry/actionCreators/modal');

function mount(
  location,
  organization,
  router,
  eventView,
  savedQuery,
  yAxis,
  disabled = false,
  setSavedQuery = jest.fn()
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
      setSavedQuery={setSavedQuery}
      setHomepageQuery={jest.fn()}
    />
  );
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
      mount(location, organization, router, errorsView, undefined, yAxis, true);

      expect(screen.getByRole('button', {name: /save as/i})).toBeDisabled();
    });

    it('renders the correct set of buttons', () => {
      mount(location, organization, router, errorsView, undefined, yAxis);

      expect(screen.getByRole('button', {name: /save as/i})).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: /saved for org/i})
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: /save changes/i})
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('button', {name: /delete/i})).not.toBeInTheDocument();
    });

    it('renders the correct set of buttons with the homepage query feature', () => {
      organization = TestStubs.Organization({
        features: [
          'discover-query',
          'dashboards-edit',
          'discover-query-builder-as-landing-page',
        ],
      });
      mount(location, organization, router, errorsView, undefined, yAxis);

      expect(screen.getByRole('button', {name: /save as/i})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: /set as default/i})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: /saved queries/i})).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: /discover context menu/i})
      ).toBeInTheDocument();

      expect(
        screen.queryByRole('button', {name: /saved for org/i})
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: /save changes/i})
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('button', {name: /delete/i})).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: /add to dashboard/i})
      ).not.toBeInTheDocument();
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
      mount(location, organization, router, errorsViewSaved, savedQuery, yAxis);

      expect(screen.queryByRole('button', {name: /save as/i})).not.toBeInTheDocument();
      expect(screen.getByRole('button', {name: /saved for org/i})).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: /save changes/i})
      ).not.toBeInTheDocument();
      expect(screen.getByRole('button', {name: /delete/i})).toBeInTheDocument();
    });

    it('treats undefined yAxis the same as count() when checking for changes', () => {
      mount(
        location,
        organization,
        router,
        errorsViewSaved,
        {...savedQuery, yAxis: undefined},
        ['count()']
      );

      expect(screen.queryByRole('button', {name: /save as/i})).not.toBeInTheDocument();
      expect(screen.getByRole('button', {name: /saved for org/i})).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: /save changes/i})
      ).not.toBeInTheDocument();
      expect(screen.getByRole('button', {name: /delete/i})).toBeInTheDocument();
    });

    it('converts string yAxis values to array when checking for changes', () => {
      mount(
        location,
        organization,
        router,
        errorsViewSaved,
        {...savedQuery, yAxis: 'count()'},
        ['count()']
      );

      expect(screen.queryByRole('button', {name: /save as/i})).not.toBeInTheDocument();
      expect(screen.getByRole('button', {name: /saved for org/i})).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: /save changes/i})
      ).not.toBeInTheDocument();
      expect(screen.getByRole('button', {name: /delete/i})).toBeInTheDocument();
    });

    it('deletes the saved query', () => {
      mount(location, organization, router, errorsViewSaved, savedQuery, yAxis);

      userEvent.click(screen.getByRole('button', {name: /delete/i}));

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
      mount(
        location,
        organization,
        router,
        errorsViewModified,
        errorsViewSaved.toNewQuery(),
        yAxis
      );

      expect(screen.queryByRole('button', {name: /save as/i})).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: /saved for org/i})
      ).not.toBeInTheDocument();
      expect(screen.getByRole('button', {name: /save changes/i})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: /delete/i})).toBeInTheDocument();
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
        userEvent.click(screen.getByRole('button', {name: /save changes/i}));

        await waitFor(() => {
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
      mount(location, metricAlertOrg, router, errorsViewModified, savedQuery, yAxis);

      expect(screen.getByRole('button', {name: /create alert/i})).toBeInTheDocument();
    });
    it('does not render create alert button without metric alerts', () => {
      mount(location, organization, router, errorsViewModified, savedQuery, yAxis);

      expect(
        screen.queryByRole('button', {name: /create alert/i})
      ).not.toBeInTheDocument();
    });
  });
});
