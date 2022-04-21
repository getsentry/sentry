import {mountWithTheme} from 'sentry-test/enzyme';

import * as navigation from 'sentry/actionCreators/navigation';
import CreateAlertButton, {
  CreateAlertFromViewButton,
} from 'sentry/components/createAlertButton';
import EventView from 'sentry/utils/discover/eventView';
import {ALL_VIEWS, DEFAULT_EVENT_VIEW} from 'sentry/views/eventsV2/data';

const onIncompatibleQueryMock = jest.fn();
const onCloseMock = jest.fn();
const onSuccessMock = jest.fn();

function generateWrappedComponent(organization, eventView) {
  return mountWithTheme(
    <CreateAlertFromViewButton
      location={location}
      organization={organization}
      eventView={eventView}
      projects={[TestStubs.Project()]}
      onIncompatibleQuery={onIncompatibleQueryMock}
      onSuccess={onSuccessMock}
    />
  );
}

function generateWrappedComponentButton(organization, extraProps) {
  return mountWithTheme(
    <CreateAlertButton organization={organization} {...extraProps} />
  );
}

describe('CreateAlertFromViewButton', () => {
  const organization = TestStubs.Organization();

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders', () => {
    const eventView = EventView.fromSavedQuery(DEFAULT_EVENT_VIEW);
    const wrapper = generateWrappedComponent(organization, eventView);
    expect(wrapper.text()).toBe('Create Alert');
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
    expect(errorsAlert.text()).toContain('An alert needs a filter of event.type:error');
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

  it('should allow yAxis with a measurement as the parameter', () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
      query: 'event.type:transaction',
      yAxis: 'p75(measurements.fcp)',
      fields: [...DEFAULT_EVENT_VIEW.fields, 'p75(measurements.fcp)'],
      projects: [2],
    });
    expect(eventView.getYAxis()).toBe('p75(measurements.fcp)');
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

    const button = wrapper.find('button[aria-label="Create Alert"]');
    expect(button.props()['aria-disabled']).toBe(true);
  });

  it('shows a guide for members', async () => {
    const noAccessOrg = {
      ...organization,
      access: [],
    };

    const wrapper = generateWrappedComponentButton(noAccessOrg, {
      showPermissionGuide: true,
    });

    const guide = wrapper.find('GuideAnchor');
    expect(guide.props().target).toBe('alerts_write_member');
  });

  it('shows a guide for owners/admins', async () => {
    const adminAccessOrg = {
      ...organization,
      access: ['org:write'],
    };

    const wrapper = generateWrappedComponentButton(adminAccessOrg, {
      showPermissionGuide: true,
    });

    const guide = wrapper.find('GuideAnchor');
    expect(guide.props().target).toBe('alerts_write_owner');
    expect(guide.props().onFinish).toBeDefined();
  });

  it('redirects to alert wizard with no project', async () => {
    jest.spyOn(navigation, 'navigateTo');

    const wrapper = generateWrappedComponentButton(organization);
    wrapper.simulate('click');
    expect(navigation.navigateTo).toHaveBeenCalledWith(
      `/organizations/org-slug/alerts/:projectId/wizard/`,
      undefined
    );
  });

  it('redirects to alert wizard with a project', async () => {
    const wrapper = generateWrappedComponentButton(organization, {
      projectSlug: 'proj-slug',
    });

    expect(wrapper.find('Button').props().to).toBe(
      `/organizations/org-slug/alerts/proj-slug/wizard/`
    );
  });

  it('removes a duplicate project filter', async () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
      query: 'event.type:error project:project-slug',
      projects: [2],
    });
    const wrapper = generateWrappedComponent(organization, eventView);

    expect(wrapper.find('Button').props().to).toEqual(
      expect.objectContaining({
        pathname: `/organizations/org-slug/alerts/project-slug/new/`,
        query: expect.objectContaining({
          query: 'event.type:error ',
        }),
      })
    );
  });
});
