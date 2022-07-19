import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {IncompatibleAlertQuery} from 'sentry/components/incompatibleAlertQuery';
import EventView from 'sentry/utils/discover/eventView';
import {ALL_VIEWS, DEFAULT_EVENT_VIEW} from 'sentry/views/eventsV2/data';

const onCloseMock = jest.fn();

function renderComponent(eventView: EventView) {
  const organization = TestStubs.Organization();
  return render(
    <IncompatibleAlertQuery
      orgSlug={organization.slug}
      eventView={eventView}
      onClose={onCloseMock}
    />
  );
}

describe('IncompatibleAlertQuery', () => {
  it('should call onClose', () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
      query: 'event.type:error',
    });
    renderComponent(eventView);
    userEvent.click(screen.getByRole('button', {name: 'Close'}));
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('should warn when project is not selected', () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
      query: 'event.type:error',
    });
    renderComponent(eventView);
    expect(
      screen.getByText(
        'An alert can use data from only one Project. Select one and try again.'
      )
    ).toBeInTheDocument();
  });

  it('should warn when all projects are selected (-1)', () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
      query: 'event.type:error',
      projects: [-1],
    });
    renderComponent(eventView);
    expect(
      screen.getByText(
        'An alert can use data from only one Project. Select one and try again.'
      )
    ).toBeInTheDocument();
  });

  it('should warn when event.type is not specified', () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
      query: '',
      projects: [2],
    });
    renderComponent(eventView);
    expect(screen.getByText('An alert needs a filter of')).toBeInTheDocument();
    expect(screen.getByText('event.type:error')).toBeInTheDocument();
  });

  it('should warn when yAxis is not allowed', () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
      ...ALL_VIEWS.find(view => view.name === 'Errors by URL'),
      query: 'event.type:error',
      yAxis: ['count_unique(issue)'],
      projects: [2],
    });
    expect(eventView.getYAxis()).toBe('count_unique(issue)');
    renderComponent(eventView);
    expect(screen.getByText('An alert can’t use the metric')).toBeInTheDocument();
    expect(screen.getByText('count_unique(issue)')).toBeInTheDocument();
  });
});
