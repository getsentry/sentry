import {createMemoryRouter, RouterProvider} from 'react-router-dom';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {ProjectFixture} from 'getsentry-test/fixtures/project';
import {renderHook} from 'sentry-test/reactTestingLibrary';

import type {ButtonProps} from '@sentry/scraps/button';

import {OrganizationContext} from 'sentry/utils/organizationContext';

import {useButtonTracking} from 'getsentry/overrides/useButtonTracking';
import {rawTrackAnalyticsEvent} from 'getsentry/utils/rawTrackAnalyticsEvent';

jest.mock('getsentry/utils/rawTrackAnalyticsEvent');

describe('buttonTracking', () => {
  const organization = OrganizationFixture();

  const project = ProjectFixture({organization});

  const wrapper = ({children}: ButtonProps) => (
    <OrganizationContext value={organization}>
      <RouterProvider
        router={createMemoryRouter(
          [
            {
              path: '/',
              handle: {path: '/'},
              children: [
                {
                  path: 'settings/',
                  handle: {path: '/settings/'},
                  children: [
                    {
                      path: ':orgId/',
                      handle: {path: ':orgId/'},
                      children: [
                        {
                          path: ':projectId/',
                          handle: {path: 'projects/:projectId/'},
                          element: children,
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
          {initialEntries: [`/settings/${organization.slug}/${project.slug}/`]}
        )}
        future={{v7_startTransition: true}}
      />
    </OrganizationContext>
  );

  const anonymousWrapper = ({children}: ButtonProps) => (
    <OrganizationContext value={null}>
      <RouterProvider
        router={createMemoryRouter(
          [
            {
              path: '/auth/login/',
              handle: {path: '/auth/login/'},
              element: children,
            },
          ],
          {initialEntries: ['/auth/login/']}
        )}
        future={{v7_startTransition: true}}
      />
    </OrganizationContext>
  );

  afterEach(() => {
    jest.mocked(rawTrackAnalyticsEvent).mockClear();
  });

  it('calls rawTrackAnalyticsEvent with default values', () => {
    const {result} = renderHook(useButtonTracking, {
      wrapper,
    });

    result.current({clickType: 'button', 'aria-label': 'Create Alert'});

    expect(rawTrackAnalyticsEvent).toHaveBeenCalledWith({
      eventName: null,
      eventKey: 'button_click.settings.:org_id.projects.:project_id',
      organization: expect.objectContaining(organization),
      parameterized_path: 'settings.:org_id.projects.:project_id',
      text: 'Create Alert',
    });
    expect(rawTrackAnalyticsEvent).toHaveBeenCalledTimes(1);
  });

  it('does not set a default Reload event key for links', () => {
    const {result} = renderHook(useButtonTracking, {
      wrapper,
    });

    result.current({clickType: 'link', 'aria-label': 'Open Issues'});

    expect(rawTrackAnalyticsEvent).toHaveBeenCalledWith({
      eventName: null,
      eventKey: undefined,
      organization: expect.objectContaining(organization),
      parameterized_path: 'settings.:org_id.projects.:project_id',
      text: 'Open Issues',
    });
    expect(rawTrackAnalyticsEvent).toHaveBeenCalledTimes(1);
  });

  it('preserves an explicit Reload event key for links', () => {
    const {result} = renderHook(useButtonTracking, {
      wrapper,
    });

    result.current({
      clickType: 'link',
      'aria-label': 'Open Issues',
      analyticsEventKey: 'issues.opened',
    });

    expect(rawTrackAnalyticsEvent).toHaveBeenCalledWith({
      eventName: null,
      eventKey: 'issues.opened',
      organization: expect.objectContaining(organization),
      parameterized_path: 'settings.:org_id.projects.:project_id',
      text: 'Open Issues',
    });
    expect(rawTrackAnalyticsEvent).toHaveBeenCalledTimes(1);
  });

  it('calls rawTrackAnalyticsEvent with data', () => {
    const {result} = renderHook(useButtonTracking, {
      wrapper,
    });

    result.current({
      clickType: 'button',
      'aria-label': 'Create Alert',
      analyticsEventKey: 'settings.create_alert',
      analyticsEventName: 'Settings: Create Alert',
      analyticsParams: {priority: 'primary', href: 'sentry.io/settings/create_alert'},
    });

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

  it('calls rawTrackAnalyticsEvent with new event names', () => {
    const {result} = renderHook(useButtonTracking, {
      wrapper,
    });

    result.current({
      clickType: 'button',
      'aria-label': 'Create Alert',
      analyticsEventKey: 'settings.create_alert',
      analyticsEventName: 'Settings: Create Alert',
    });

    expect(rawTrackAnalyticsEvent).toHaveBeenCalledWith({
      eventName: 'Settings: Create Alert',
      eventKey: 'settings.create_alert',
      organization: expect.objectContaining(organization),
      parameterized_path: 'settings.:org_id.projects.:project_id',
      text: 'Create Alert',
    });
    expect(rawTrackAnalyticsEvent).toHaveBeenCalledTimes(1);
  });

  it('tracks explicit events without an organization', () => {
    const {result} = renderHook(useButtonTracking, {
      wrapper: anonymousWrapper,
    });

    result.current({
      clickType: 'button',
      'aria-label': 'Return to the old login experience',
      analyticsEventKey: 'auth_v2.login.legacy_fallback_clicked',
      analyticsEventName: 'Auth V2: Legacy Login Fallback Clicked',
      analyticsParams: {state: 'login'},
    });

    expect(rawTrackAnalyticsEvent).toHaveBeenCalledWith({
      eventName: 'Auth V2: Legacy Login Fallback Clicked',
      eventKey: 'auth_v2.login.legacy_fallback_clicked',
      organization: null,
      parameterized_path: 'auth.login',
      text: 'Return to the old login experience',
      state: 'login',
    });
  });

  it('does not track automatic button events without an organization', () => {
    const {result} = renderHook(useButtonTracking, {
      wrapper: anonymousWrapper,
    });

    result.current({clickType: 'button', 'aria-label': 'Uninstrumented'});

    expect(rawTrackAnalyticsEvent).not.toHaveBeenCalled();
  });
});
