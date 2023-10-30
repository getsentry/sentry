import {Organization} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import EventView from 'sentry/utils/discover/eventView';
import {IncompatibleAlertQuery} from 'sentry/views/alerts/rules/metric/incompatibleAlertQuery';
import {ALL_VIEWS, DEFAULT_EVENT_VIEW} from 'sentry/views/discover/data';

function renderComponent(eventView: EventView) {
  const organization = Organization();
  return render(
    <IncompatibleAlertQuery orgSlug={organization.slug} eventView={eventView} />
  );
}

describe('IncompatibleAlertQuery', () => {
  it('should call onClose', async () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
      query: 'event.type:error',
    });
    const wrapper = renderComponent(eventView);
    await userEvent.click(screen.getByRole('button', {name: 'Close'}));
    expect(wrapper.container).toBeEmptyDOMElement();
  });

  it('should warn when project is not selected', () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
      query: 'event.type:error',
    });
    renderComponent(eventView);
    expect(screen.getByText('No project was selected')).toBeInTheDocument();
  });

  it('should warn when all projects are selected (-1)', () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
      query: 'event.type:error',
      projects: [-1],
    });
    renderComponent(eventView);
    expect(screen.getByText('No project was selected')).toBeInTheDocument();
  });

  it('should warn when event.type is not specified', () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
      query: '',
      projects: [2],
    });
    renderComponent(eventView);
    expect(screen.getByText(/An event type wasn't selected/)).toHaveTextContent(
      "An event type wasn't selected. event.type:error has been set as the default"
    );
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
    expect(
      screen.getByText('An alert can’t use the metric just yet.')
    ).toBeInTheDocument();
    expect(screen.getByText('count_unique(issue)')).toBeInTheDocument();
  });

  it('should allow yAxis with a number as the parameter', () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
      query: 'event.type:transaction',
      yAxis: ['apdex(300)'],
      fields: [...DEFAULT_EVENT_VIEW.fields, 'apdex(300)'],
      projects: [2],
    });
    expect(eventView.getYAxis()).toBe('apdex(300)');
    const wrapper = renderComponent(eventView);
    expect(wrapper.container).toBeEmptyDOMElement();
  });

  it('should allow yAxis with a measurement as the parameter', () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
      query: 'event.type:transaction',
      yAxis: ['p75(measurements.fcp)'],
      fields: [...DEFAULT_EVENT_VIEW.fields, 'p75(measurements.fcp)'],
      projects: [2],
    });
    expect(eventView.getYAxis()).toBe('p75(measurements.fcp)');
    const wrapper = renderComponent(eventView);
    expect(wrapper.container).toBeEmptyDOMElement();
  });

  it('should warn with multiple errors, missing event.type and project', () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
      ...ALL_VIEWS.find(view => view.name === 'Errors by URL'),
      query: '',
      yAxis: ['count_unique(issue.id)'],
      projects: [],
    });
    renderComponent(eventView);
    expect(screen.getByText('No project was selected')).toBeInTheDocument();
    expect(screen.getByText(/An event type wasn't selected/)).toHaveTextContent(
      "An event type wasn't selected. event.type:error has been set as the default"
    );
  });
});
