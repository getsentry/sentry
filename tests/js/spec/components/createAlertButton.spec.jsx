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
    const wrapper = generateWrappedComponent(organization, eventView);
    expect(wrapper.text()).toBe('Create alert');
  });

  it('should warn when project is not selected', () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
      query: 'event.type:error',
    });
    const wrapper = generateWrappedComponent(organization, eventView);
    wrapper.simulate('click');
    expect(onIncompatibleQueryMock).toHaveBeenCalledTimes(1);
    const errorsAlert = mountWithTheme(
      onIncompatibleQueryMock.mock.calls[0][0](onCloseMock)
    );
    expect(errorsAlert.text()).toBe(
      'An alert can use data from only one Project. Select one and try again.'
    );
  });

  it('should warn when all projects are selected (-1)', () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
      query: 'event.type:error',
      projects: [-1],
    });
    const wrapper = generateWrappedComponent(organization, eventView);
    wrapper.simulate('click');
    expect(onIncompatibleQueryMock).toHaveBeenCalledTimes(1);
    const errorsAlert = mountWithTheme(
      onIncompatibleQueryMock.mock.calls[0][0](onCloseMock)
    );
    expect(errorsAlert.text()).toBe(
      'An alert can use data from only one Project. Select one and try again.'
    );
  });

  it('should warn when event.type is not specified', () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
      query: '',
      projects: [2],
    });
    const wrapper = generateWrappedComponent(organization, eventView);
    wrapper.simulate('click');
    expect(onIncompatibleQueryMock).toHaveBeenCalledTimes(1);
    const errorsAlert = mountWithTheme(
      onIncompatibleQueryMock.mock.calls[0][0](onCloseMock)
    );
    expect(errorsAlert.text()).toBe(
      'An alert needs a filter of event.type:error or event.type:transaction. Use one of these and try again.'
    );
  });

  it('should warn when yAxis is not allowed', () => {
    const eventView = EventView.fromSavedQuery({
      ...ALL_VIEWS.find(view => view.name === 'Errors by URL'),
      query: 'event.type:error',
      yAxis: 'count_unique(issue)',
      projects: [2],
    });
    expect(eventView.getYAxis()).toBe('count_unique(issue)');
    const wrapper = generateWrappedComponent(organization, eventView);
    wrapper.simulate('click');
    expect(onIncompatibleQueryMock).toHaveBeenCalledTimes(1);
    const errorsAlert = mountWithTheme(
      onIncompatibleQueryMock.mock.calls[0][0](onCloseMock)
    );
    expect(errorsAlert.text()).toBe(
      'An alert can’t use the metric count_unique(issue) just yet. Select another metric and try again.'
    );
  });

  it('should allow yAxis with a number as the parameter', () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
      query: 'event.type:transaction',
      yAxis: 'apdex(300)',
      fields: [...DEFAULT_EVENT_VIEW.fields, 'apdex(300)'],
      projects: [2],
    });
    expect(eventView.getYAxis()).toBe('apdex(300)');
    const wrapper = generateWrappedComponent(organization, eventView);
    wrapper.simulate('click');
    expect(onIncompatibleQueryMock).toHaveBeenCalledTimes(0);
  });

  it('should warn with multiple errors, missing event.type and project', () => {
    const eventView = EventView.fromSavedQuery({
      ...ALL_VIEWS.find(view => view.name === 'Errors by URL'),
      query: '',
      yAxis: 'count_unique(issue.id)',
      projects: [],
    });
    const wrapper = generateWrappedComponent(organization, eventView);
    wrapper.simulate('click');
    expect(onIncompatibleQueryMock).toHaveBeenCalledTimes(1);
    const errorsAlert = mountWithTheme(
      onIncompatibleQueryMock.mock.calls[0][0](onCloseMock)
    );
    expect(errorsAlert.text()).toContain('Yikes! That button didn’t work.');
  });

  it('should trigger success callback', () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
      query: 'event.type:error',
      projects: [2],
    });
    const wrapper = generateWrappedComponent(organization, eventView);
    wrapper.simulate('click');
    expect(onIncompatibleQueryMock).toHaveBeenCalledTimes(0);
    expect(onSuccessMock).toHaveBeenCalledTimes(1);
  });

  it('should allow alert to close', () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
    });
    const wrapper = generateWrappedComponent(organization, eventView);
    wrapper.simulate('click');
    expect(onIncompatibleQueryMock).toHaveBeenCalledTimes(1);
    const errorsAlert = mountWithTheme(
      onIncompatibleQueryMock.mock.calls[0][0](onCloseMock)
    );
    errorsAlert.find('[aria-label="Close"]').at(0).simulate('click');
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('disables the create alert button for members', async () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
    });
    const noAccessOrg = {
      ...organization,
      access: [],
    };

    const wrapper = generateWrappedComponent(noAccessOrg, eventView);

    const button = wrapper.find('button[aria-label="Create alert"]');
    expect(button.props()['aria-disabled']).toBe(true);
  });
});
