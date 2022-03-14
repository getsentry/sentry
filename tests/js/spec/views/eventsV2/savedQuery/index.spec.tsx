import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {openAddDashboardWidgetModal} from 'sentry/actionCreators/modal';
import {NewQuery} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {DisplayModes} from 'sentry/utils/discover/types';
import {ALL_VIEWS} from 'sentry/views/eventsV2/data';
import SavedQueryButtonGroup from 'sentry/views/eventsV2/savedQuery';

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

describe('EventsV2 > SaveQueryButtonGroup', function () {
  const yAxis = ['count()', 'failure_count()'];

  const errorsQuery = {
    ...(ALL_VIEWS.find(view => view.name === 'Errors by Title') as NewQuery),
    yAxis: ['count()'],
    display: DisplayModes.DEFAULT,
  };

  const errorsViewSaved = EventView.fromSavedQuery(errorsQuery);
  errorsViewSaved.id = '1';

  const errorsViewModified = EventView.fromSavedQuery(errorsQuery);
  errorsViewModified.id = '1';
  errorsViewModified.name = 'Modified Name';

  const savedQuery = {...errorsViewSaved.toNewQuery(), yAxis};

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
            name: '',
            orderby: '-count',
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
            name: '',
            orderby: '-count',
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
            name: '',
            orderby: '-count',
          },
          displayType: 'line',
        })
      );
    });
  });
});
