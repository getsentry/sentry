import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {DEFAULT_EVENT_VIEW, ALL_VIEWS} from 'app/views/eventsV2/data';
import CreateAlertButton from 'app/components/createAlertButton';
import EventView from 'app/utils/discover/eventView';

const onIncompatibleQueryMock = jest.fn();
const onCloseMock = jest.fn();
const onSuccessMock = jest.fn();

function generateWrappedComponent(organization, eventView) {
  return mountWithTheme(
    <CreateAlertButton
      location={location}
      organization={organization}
      eventView={eventView}
      projects={[]}
      onIncompatibleQuery={onIncompatibleQueryMock}
      onClose={onCloseMock}
      onSuccess={onSuccessMock}
    />,
    TestStubs.routerContext()
  );
}

describe('CreateAlertButton', () => {
  const organization = TestStubs.Organization();

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders', () => {
    const eventView = EventView.fromSavedQuery(DEFAULT_EVENT_VIEW);
    const component = generateWrappedComponent(organization, eventView);
    expect(component.text()).toBe('Create alert');
  });

  it('should warn when project is not selected', () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
      query: 'event.type:error',
    });
    const component = generateWrappedComponent(organization, eventView);
    component.simulate('click');
    expect(onIncompatibleQueryMock).toHaveBeenCalledTimes(1);
    const errorsAlert = mountWithTheme(onIncompatibleQueryMock.mock.calls[0][0]);
    expect(errorsAlert.text()).toBe('Select one project to create a new alert.');
  });

  it('should warn when all projects are selected (-1)', () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
      query: 'event.type:error',
      projects: [-1],
    });
    const component = generateWrappedComponent(organization, eventView);
    component.simulate('click');
    expect(onIncompatibleQueryMock).toHaveBeenCalledTimes(1);
    const errorsAlert = mountWithTheme(onIncompatibleQueryMock.mock.calls[0][0]);
    expect(errorsAlert.text()).toBe('Select one project to create a new alert.');
  });

  it('should warn when event.type is not specified', () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
      query: '',
      projects: [2],
    });
    const component = generateWrappedComponent(organization, eventView);
    component.simulate('click');
    expect(onIncompatibleQueryMock).toHaveBeenCalledTimes(1);
    const errorsAlert = mountWithTheme(onIncompatibleQueryMock.mock.calls[0][0]);
    expect(errorsAlert.text()).toBe(
      'Select either event.type:error or event.type:transaction to create a new alert.'
    );
  });

  it('should warn when yAxis is not allowed', () => {
    const eventView = EventView.fromSavedQuery({
      ...ALL_VIEWS.find(view => view.name === 'Errors by URL'),
      query: 'event.type:error',
      yAxis: 'count_unique(issue.id)',
      projects: [2],
    });
    expect(eventView.getYAxis()).toBe('count_unique(issue.id)');
    const component = generateWrappedComponent(organization, eventView);
    component.simulate('click');
    expect(onIncompatibleQueryMock).toHaveBeenCalledTimes(1);
    const errorsAlert = mountWithTheme(onIncompatibleQueryMock.mock.calls[0][0]);
    expect(errorsAlert.text()).toBe(
      'count_unique(issue.id) is not supported by alerts just yet. Select a different metric below and try again.'
    );
  });

  it('should warn with multiple errors, missing event.type and project', () => {
    const eventView = EventView.fromSavedQuery({
      ...ALL_VIEWS.find(view => view.name === 'Errors by URL'),
      query: '',
      yAxis: 'count_unique(issue.id)',
      projects: [],
    });
    const component = generateWrappedComponent(organization, eventView);
    component.simulate('click');
    expect(onIncompatibleQueryMock).toHaveBeenCalledTimes(1);
    const errorsAlert = mountWithTheme(onIncompatibleQueryMock.mock.calls[0][0]);
    expect(errorsAlert.text()).toContain(
      'The world is a cruel and unforgiving place and that button didn’t work because:'
    );
  });

  it('should trigger success callback', () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
      query: 'event.type:error',
      projects: [2],
    });
    const component = generateWrappedComponent(organization, eventView);
    component.simulate('click');
    expect(onIncompatibleQueryMock).toHaveBeenCalledTimes(0);
    expect(onSuccessMock).toHaveBeenCalledTimes(1);
  });

  it('should allow alert to close', () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
    });
    const component = generateWrappedComponent(organization, eventView);
    component.simulate('click');
    expect(onIncompatibleQueryMock).toHaveBeenCalledTimes(1);
    const errorsAlert = mountWithTheme(onIncompatibleQueryMock.mock.calls[0][0]);
    errorsAlert
      .find('[aria-label="Close"]')
      .at(0)
      .simulate('click');
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });
});
