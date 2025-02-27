import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {ProjectFixture} from 'getsentry-test/fixtures/project';
import {renderHook} from 'sentry-test/reactTestingLibrary';

import type {ButtonProps} from 'sentry/components/button';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {TestRouteContext} from 'sentry/views/routeContext';

import useButtonTracking from 'getsentry/hooks/useButtonTracking';
import rawTrackAnalyticsEvent from 'getsentry/utils/rawTrackAnalyticsEvent';

jest.mock('getsentry/utils/rawTrackAnalyticsEvent');

describe('buttonTracking', function () {
  const organization = OrganizationFixture();

  const project = ProjectFixture({organization});

  const router = {
    location: LocationFixture({
      pathname: `/settings/${organization.slug}/${project.slug}/`,
    }),
    params: {orgId: organization.slug},
    routes: [
      {path: '/'},
      {path: '/settings/'},
      {path: ':orgId/'},
      {path: 'projects/:projectId/'},
    ],
    router: RouterFixture(),
  };

  const wrapper = ({children}: ButtonProps) => (
    <OrganizationContext.Provider value={organization}>
      <TestRouteContext.Provider value={router}>{children}</TestRouteContext.Provider>
    </OrganizationContext.Provider>
  );

  afterEach(function () {
    (rawTrackAnalyticsEvent as jest.Mock).mockClear();
  });

  it('calls rawTrackAnalyticsEvent with default values', function () {
    const {result} = renderHook(useButtonTracking, {
      initialProps: {'aria-label': 'Create Alert'},
      wrapper,
    });

    result.current();

    expect(rawTrackAnalyticsEvent).toHaveBeenCalledWith({
      eventName: null,
      eventKey: 'button_click.settings.:org_id.projects.:project_id',
      organization: expect.objectContaining(organization),
      parameterized_path: 'settings.:org_id.projects.:project_id',
      text: 'Create Alert',
    });
    expect(rawTrackAnalyticsEvent).toHaveBeenCalledTimes(1);
  });

  it('calls rawTrackAnalyticsEvent with data', function () {
    const {result} = renderHook(useButtonTracking, {
      initialProps: {
        'aria-label': 'Create Alert',
        analyticsEventKey: 'settings.create_alert',
        analyticsEventName: 'Settings: Create Alert',
        analyticsParams: {priority: 'primary', href: 'sentry.io/settings/create_alert'},
      },
      wrapper,
    });

    result.current();

    expect(rawTrackAnalyticsEvent).toHaveBeenCalledWith({
      eventName: 'Settings: Create Alert',
      eventKey: 'settings.create_alert',
      organization: expect.objectContaining(organization),
      parameterized_path: 'settings.:org_id.projects.:project_id',
      text: 'Create Alert',
      priority: 'primary',
      href: 'sentry.io/settings/create_alert',
    });
    expect(rawTrackAnalyticsEvent).toHaveBeenCalledTimes(1);
  });

  it('calls rawTrackAnalyticsEvent with new event names', function () {
    const {result} = renderHook(useButtonTracking, {
      initialProps: {
        'aria-label': 'Create Alert',
        analyticsEventKey: 'settings.create_alert',
        analyticsEventName: 'Settings: Create Alert',
      },
      wrapper,
    });

    result.current();

    expect(rawTrackAnalyticsEvent).toHaveBeenCalledWith({
      eventName: 'Settings: Create Alert',
      eventKey: 'settings.create_alert',
      organization: expect.objectContaining(organization),
      parameterized_path: 'settings.:org_id.projects.:project_id',
      text: 'Create Alert',
    });
    expect(rawTrackAnalyticsEvent).toHaveBeenCalledTimes(1);
  });
});
