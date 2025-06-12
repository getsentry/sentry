import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterPropsFixture} from 'sentry-fixture/routerPropsFixture';

import {ProjectFixture} from 'getsentry-test/fixtures/project';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import useRouteActivatedHook, {
  DELAY_TIME_MS,
} from 'getsentry/hooks/useRouteActivatedHook';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import rawTrackAnalyticsEvent from 'getsentry/utils/rawTrackAnalyticsEvent';

const DEFAULT_ADVANCE_PERIOD = DELAY_TIME_MS * 1.2;
const HALF_ADVANCE_PERIOD = DELAY_TIME_MS * 0.6;

jest.mock('getsentry/utils/rawTrackAnalyticsEvent');

describe('useRouteActivatedHook', function () {
  const organization = OrganizationFixture();
  const project = ProjectFixture({organization});
  const subscription = SubscriptionFixture({
    organization,
  });
  function genProps(extraRouteParams = {}): any {
    const props = {
      organization,
      ...RouterPropsFixture({
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
      }),
      ...extraRouteParams,
    };
    return props;
  }
  const props = genProps();

  beforeEach(function () {
    SubscriptionStore.set(organization.slug, subscription);
  });

  afterEach(function () {
    (rawTrackAnalyticsEvent as jest.Mock).mockClear();
  });

  it('calls rawTrackAnalyticsEvent after one seconds if org is set', function () {
    jest.useFakeTimers();
    const {result} = renderHook(useRouteActivatedHook, {
      initialProps: props,
    });
    act(() => result.current.setOrganization(organization));
    const loadTime = Date.now();
    act(() => jest.advanceTimersByTime(HALF_ADVANCE_PERIOD));
    expect(rawTrackAnalyticsEvent).toHaveBeenCalledTimes(0);
    act(() => jest.advanceTimersByTime(HALF_ADVANCE_PERIOD));
    expect(rawTrackAnalyticsEvent).toHaveBeenCalledWith(
      {
        eventName: 'Page View: Settings :OrgId Projects :ProjectId',
        eventKey: 'page_view.settings.:org_id.projects.:project_id',
        parameterized_path: 'settings.:org_id.projects.:project_id',
        organization: expect.objectContaining(organization),
        subscription: expect.objectContaining(subscription),
        url: `http://localhost/settings/${organization.slug}/${project.slug}/`,
      },
      {time: loadTime}
    );
    expect(rawTrackAnalyticsEvent).toHaveBeenCalledTimes(1);
  });

  it('does not call rawTrackAnalyticsEvent if org is not set', function () {
    jest.useFakeTimers();
    renderHook(useRouteActivatedHook, {
      initialProps: props,
    });
    act(() => jest.advanceTimersByTime(DEFAULT_ADVANCE_PERIOD));
    expect(rawTrackAnalyticsEvent).toHaveBeenCalledTimes(0);
  });

  it('only calls rawTrackAnalyticsEvent once and ignores later param updates', function () {
    jest.useFakeTimers();
    const {result} = renderHook(useRouteActivatedHook, {
      initialProps: props,
    });
    const loadTime = Date.now();
    act(() => result.current.setOrganization(organization));
    act(() => result.current.setRouteAnalyticsParams({foo: 'bar'}));
    act(() => jest.advanceTimersByTime(DEFAULT_ADVANCE_PERIOD));
    act(() => result.current.setRouteAnalyticsParams({field: 'value', foo: 'baz'}));
    expect(rawTrackAnalyticsEvent).toHaveBeenCalledWith(
      {
        eventName: 'Page View: Settings :OrgId Projects :ProjectId',
        eventKey: 'page_view.settings.:org_id.projects.:project_id',
        parameterized_path: 'settings.:org_id.projects.:project_id',
        organization: expect.objectContaining(organization),
        subscription: expect.objectContaining(subscription),
        url: `http://localhost/settings/${organization.slug}/${project.slug}/`,
        foo: 'bar',
      },
      {time: loadTime}
    );
    expect(rawTrackAnalyticsEvent).toHaveBeenCalledTimes(1);
  });

  it('only calls rawTrackAnalyticsEvent once when URL query params are updated', function () {
    jest.useFakeTimers();
    const {result, rerender} = renderHook(useRouteActivatedHook, {
      initialProps: props,
    });
    act(() => result.current.setOrganization(organization));
    act(() =>
      rerender(
        genProps({
          location: LocationFixture({
            pathname: `/settings/${organization.slug}/${project.slug}/`,
            search: '?foo=bar',
          }),
        })
      )
    );
    act(() => jest.advanceTimersByTime(DEFAULT_ADVANCE_PERIOD));
    expect(rawTrackAnalyticsEvent).toHaveBeenCalledTimes(1);
  });

  it('disable route analytics', function () {
    jest.useFakeTimers();
    const {result} = renderHook(useRouteActivatedHook, {
      initialProps: props,
    });
    act(() => result.current.setOrganization(organization));
    act(() => result.current.setDisableRouteAnalytics());
    act(() => jest.advanceTimersByTime(DEFAULT_ADVANCE_PERIOD));
    expect(rawTrackAnalyticsEvent).toHaveBeenCalledTimes(0);
  });

  it('disables and re-enables analytics', function () {
    jest.useFakeTimers();
    const {result} = renderHook(useRouteActivatedHook, {
      initialProps: props,
    });
    act(() => result.current.setOrganization(organization));
    act(() => result.current.setDisableRouteAnalytics(true));
    act(() => jest.advanceTimersByTime(DEFAULT_ADVANCE_PERIOD));
    expect(rawTrackAnalyticsEvent).toHaveBeenCalledTimes(0);
    act(() => result.current.setDisableRouteAnalytics(false));
    act(() => jest.advanceTimersByTime(DEFAULT_ADVANCE_PERIOD));
    expect(rawTrackAnalyticsEvent).toHaveBeenCalledTimes(1);
  });

  it('re-initializes after route changes', function () {
    jest.useFakeTimers();
    const {result, rerender} = renderHook(useRouteActivatedHook, {
      initialProps: props,
    });
    act(() => result.current.setOrganization(organization));
    // set every field to make sure we reset them
    act(() => result.current.setDisableRouteAnalytics());
    act(() => result.current.setEventNames('foo', 'bar'));
    act(() => result.current.setRouteAnalyticsParams({ignore: 'yes'}));
    act(() => jest.advanceTimersByTime(DEFAULT_ADVANCE_PERIOD));
    expect(rawTrackAnalyticsEvent).toHaveBeenCalledTimes(0);

    const newProps = genProps({
      location: LocationFixture({
        pathname: `/organizations/${organization.slug}/releases/some-release/`,
      }),
      routes: [
        {path: '/'},
        {path: '/organizations/:orgId/releases/'},
        {path: ':release/'},
      ],
      ...LocationFixture({
        pathname: `/organizations/${organization.slug}/releases/some-release/`,
      }),
    });
    const loadTime = Date.now();
    act(() => rerender(newProps));
    act(() => jest.advanceTimersByTime(DEFAULT_ADVANCE_PERIOD));
    expect(rawTrackAnalyticsEvent).toHaveBeenCalledWith(
      {
        eventName: 'Page View: Organizations :OrgId Releases :Release',
        eventKey: 'page_view.organizations.:org_id.releases.:release',
        parameterized_path: 'organizations.:org_id.releases.:release',
        organization: expect.objectContaining(organization),
        subscription: expect.objectContaining(subscription),
        url: `http://localhost/organizations/${organization.slug}/releases/some-release/`,
      },
      {time: loadTime}
    );
    expect(rawTrackAnalyticsEvent).toHaveBeenCalledTimes(1);
  });

  it('overrwite event names', function () {
    jest.useFakeTimers();
    const {result} = renderHook(useRouteActivatedHook, {
      initialProps: props,
    });
    act(() => result.current.setOrganization(organization));
    act(() => result.current.setEventNames('test.event', 'Test Event'));
    const loadTime = Date.now();
    act(() => jest.advanceTimersByTime(DEFAULT_ADVANCE_PERIOD));
    expect(rawTrackAnalyticsEvent).toHaveBeenCalledWith(
      {
        eventName: 'Test Event',
        eventKey: 'test.event',
        parameterized_path: 'settings.:org_id.projects.:project_id',
        organization: expect.objectContaining(organization),
        subscription: expect.objectContaining(subscription),
        url: `http://localhost/settings/${organization.slug}/${project.slug}/`,
      },
      {time: loadTime}
    );
    expect(rawTrackAnalyticsEvent).toHaveBeenCalledTimes(1);
  });

  it('route changes triggers early analytics event', function () {
    jest.useFakeTimers();
    let loadTime = Date.now();
    const {result, rerender} = renderHook(useRouteActivatedHook, {
      initialProps: props,
    });
    act(() => result.current.setOrganization(organization));
    act(() => jest.advanceTimersByTime(HALF_ADVANCE_PERIOD));

    const newProps = genProps({
      location: LocationFixture({
        pathname: `/organizations/${organization.slug}/releases/some-release/`,
      }),
      routes: [
        {path: '/'},
        {path: '/organizations/:orgId/releases/'},
        {path: ':release/'},
      ],
      ...LocationFixture({
        pathname: `/organizations/${organization.slug}/releases/some-release/`,
      }),
    });
    expect(rawTrackAnalyticsEvent).toHaveBeenCalledTimes(0);

    // emit the first event from the previous page
    act(() => rerender(newProps));
    expect(rawTrackAnalyticsEvent).toHaveBeenCalledWith(
      {
        eventName: 'Page View: Settings :OrgId Projects :ProjectId',
        eventKey: 'page_view.settings.:org_id.projects.:project_id',
        parameterized_path: 'settings.:org_id.projects.:project_id',
        organization: expect.objectContaining(organization),
        subscription: expect.objectContaining(subscription),
        url: `http://localhost/settings/${organization.slug}/${project.slug}/`,
      },
      {time: loadTime}
    );
    expect(rawTrackAnalyticsEvent).toHaveBeenCalledTimes(1);
    loadTime = Date.now();

    // should emit the second event now
    act(() => jest.advanceTimersByTime(DEFAULT_ADVANCE_PERIOD));
    expect(rawTrackAnalyticsEvent).toHaveBeenCalledWith(
      {
        eventName: 'Page View: Organizations :OrgId Releases :Release',
        eventKey: 'page_view.organizations.:org_id.releases.:release',
        parameterized_path: 'organizations.:org_id.releases.:release',
        organization: expect.objectContaining(organization),
        subscription: expect.objectContaining(subscription),
        url: `http://localhost/organizations/${organization.slug}/releases/some-release/`,
      },
      {time: loadTime}
    );
    expect(rawTrackAnalyticsEvent).toHaveBeenCalledTimes(2);
  });
});
