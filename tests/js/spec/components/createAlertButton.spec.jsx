import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import * as navigation from 'sentry/actionCreators/navigation';
import CreateAlertButton, {
  CreateAlertFromViewButton,
} from 'sentry/components/createAlertButton';
import GuideStore from 'sentry/stores/guideStore';
import EventView from 'sentry/utils/discover/eventView';
import {ALL_VIEWS, DEFAULT_EVENT_VIEW} from 'sentry/views/eventsV2/data';

const onIncompatibleQueryMock = jest.fn();
const onSuccessMock = jest.fn();
const context = TestStubs.routerContext();

function renderComponent(organization, eventView) {
  return render(
    <CreateAlertFromViewButton
      location={location}
      organization={organization}
      eventView={eventView}
      projects={[TestStubs.Project()]}
      onIncompatibleQuery={onIncompatibleQueryMock}
      onClick={onSuccessMock}
    />,
    {context}
  );
}

function renderSimpleComponent(organization, extraProps) {
  return render(<CreateAlertButton organization={organization} {...extraProps} />);
}

describe('CreateAlertFromViewButton', () => {
  const organization = TestStubs.Organization();

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders', () => {
    const eventView = EventView.fromSavedQuery(DEFAULT_EVENT_VIEW);
    renderComponent(organization, eventView);
    expect(screen.getByRole('button')).toHaveTextContent('Create Alert');
  });

  it('should warn when project is not selected', () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
      query: 'event.type:error',
    });
    renderComponent(organization, eventView);
    userEvent.click(screen.getByRole('button', {name: 'Create Alert'}));
    expect(onIncompatibleQueryMock).toHaveBeenCalledTimes(1);
  });

  it('should warn when all projects are selected (-1)', () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
      query: 'event.type:error',
      projects: [-1],
    });
    renderComponent(organization, eventView);
    userEvent.click(screen.getByRole('button', {name: 'Create Alert'}));
    expect(onIncompatibleQueryMock).toHaveBeenCalledTimes(1);
  });

  it('should warn when event.type is not specified', () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
      query: '',
      projects: [2],
    });
    renderComponent(organization, eventView);
    userEvent.click(screen.getByRole('button', {name: 'Create Alert'}));
    expect(onIncompatibleQueryMock).toHaveBeenCalledTimes(1);
  });

  it('should warn when yAxis is not allowed', () => {
    const eventView = EventView.fromSavedQuery({
      ...ALL_VIEWS.find(view => view.name === 'Errors by URL'),
      query: 'event.type:error',
      yAxis: 'count_unique(issue)',
      projects: [2],
    });
    expect(eventView.getYAxis()).toBe('count_unique(issue)');
    renderComponent(organization, eventView);
    userEvent.click(screen.getByRole('button', {name: 'Create Alert'}));
    expect(onIncompatibleQueryMock).toHaveBeenCalledTimes(1);
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
    renderComponent(organization, eventView);
    userEvent.click(screen.getByRole('button', {name: 'Create Alert'}));
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
    renderComponent(organization, eventView);
    userEvent.click(screen.getByRole('button', {name: 'Create Alert'}));
    expect(onIncompatibleQueryMock).toHaveBeenCalledTimes(0);
  });

  it('should warn with multiple errors, missing event.type and project', () => {
    const eventView = EventView.fromSavedQuery({
      ...ALL_VIEWS.find(view => view.name === 'Errors by URL'),
      query: '',
      yAxis: 'count_unique(issue.id)',
      projects: [],
    });
    renderComponent(organization, eventView);
    userEvent.click(screen.getByRole('button', {name: 'Create Alert'}));
    expect(onIncompatibleQueryMock).toHaveBeenCalledTimes(1);
  });

  it('should trigger success callback', () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
      query: 'event.type:error',
      projects: [2],
    });
    renderComponent(organization, eventView);
    userEvent.click(screen.getByRole('button', {name: 'Create Alert'}));
    expect(onIncompatibleQueryMock).toHaveBeenCalledTimes(0);
    expect(onSuccessMock).toHaveBeenCalledTimes(1);
  });

  it('disables the create alert button for members', () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
    });
    const noAccessOrg = {
      ...organization,
      access: [],
    };

    renderComponent(noAccessOrg, eventView);
    expect(screen.getByRole('button', {name: 'Create Alert'})).toBeDisabled();
  });

  it('shows a guide for members', () => {
    const noAccessOrg = {
      ...organization,
      access: [],
    };

    renderSimpleComponent(noAccessOrg, {
      showPermissionGuide: true,
    });

    expect(GuideStore.state.anchors).toEqual(new Set(['alerts_write_member']));
  });

  it('shows a guide for owners/admins', () => {
    const adminAccessOrg = {
      ...organization,
      access: ['org:write'],
    };

    renderSimpleComponent(adminAccessOrg, {
      showPermissionGuide: true,
    });

    expect(GuideStore.state.anchors).toEqual(new Set(['alerts_write_owner']));
  });

  it('redirects to alert wizard with no project', () => {
    jest.spyOn(navigation, 'navigateTo');

    renderSimpleComponent(organization);
    userEvent.click(screen.getByRole('button'));
    expect(navigation.navigateTo).toHaveBeenCalledWith(
      `/organizations/org-slug/alerts/:projectId/wizard/`,
      undefined
    );
  });

  it('redirects to alert wizard with a project', () => {
    renderSimpleComponent(organization, {
      projectSlug: 'proj-slug',
    });

    expect(screen.getByRole('button')).toHaveAttribute(
      'href',
      '/organizations/org-slug/alerts/proj-slug/wizard/'
    );
  });

  it('removes a duplicate project filter', () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
      query: 'event.type:error project:project-slug',
      projects: [2],
    });
    renderComponent(organization, eventView);
    userEvent.click(screen.getByRole('button'));
    expect(context.context.router.push).toHaveBeenCalledWith({
      pathname: `/organizations/org-slug/alerts/project-slug/new/`,
      query: expect.objectContaining({
        query: 'event.type:error ',
      }),
    });
  });
});
