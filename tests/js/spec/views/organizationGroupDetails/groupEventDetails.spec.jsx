import {browserHistory} from 'react-router';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import GroupEventDetails from 'app/views/organizationGroupDetails/groupEventDetails/groupEventDetails';
import {ReprocessingStatus} from 'app/views/organizationGroupDetails/utils';

describe('groupEventDetails', () => {
  let org;
  let project;
  let routerContext;
  let group;
  let event;
  let promptsActivity;

  const mockGroupApis = () => {
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/`,
      body: group,
    });

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/issues/`,
      method: 'PUT',
    });

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/events/${event.id}/committers/`,
      body: {committers: []},
    });

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/events/${event.id}/owners/`,
      body: {owners: [], rules: []},
    });

    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/participants/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/tags/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/groups/${group.id}/integrations/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/groups/${group.id}/external-issues/`,
    });

    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/current-release/`,
      body: {currentRelease: null},
    });

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/releases/completion/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/prompts-activity/',
      body: promptsActivity,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/has-mobile-app-events/`,
      body: null,
    });

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/events/${event.id}/grouping-info/`,
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/codeowners/`,
      body: [],
    });
  };

  beforeEach(() => {
    const props = initializeOrg();
    org = props.organization;
    project = props.project;
    project.organization = org;
    routerContext = props.routerContext;

    group = TestStubs.Group();
    event = TestStubs.Event({
      size: 1,
      dateCreated: '2019-03-20T00:00:00.000Z',
      errors: [],
      entries: [],
      tags: [{key: 'environment', value: 'dev'}],
    });

    mockGroupApis();

    MockApiClient.addMockResponse({
      url: '/sentry-apps/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/sentry-apps/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/sentry-app-installations/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/sentry-app-components/?projectId=${project.id}`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      body: project,
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    browserHistory.replace.mockClear();
  });

  it('redirects on switching to an invalid environment selection for event', async function () {
    const wrapper = mountWithTheme(
      <GroupEventDetails
        api={new MockApiClient()}
        group={group}
        event={event}
        project={project}
        organization={org}
        environments={[{id: '1', name: 'dev', displayName: 'Dev'}]}
        params={{orgId: org.slug, groupId: group.id, eventId: '1'}}
        location={{}}
      />,
      routerContext
    );
    await tick();
    expect(browserHistory.replace).not.toHaveBeenCalled();
    wrapper.setProps({environments: [{id: '1', name: 'prod', displayName: 'Prod'}]});
    await tick();
    expect(browserHistory.replace).toHaveBeenCalled();
  });

  it('does not redirect when switching to a valid environment selection for event', async function () {
    const wrapper = mountWithTheme(
      <GroupEventDetails
        api={new MockApiClient()}
        group={group}
        event={event}
        project={project}
        organization={org}
        environments={[{id: '1', name: 'dev', displayName: 'Dev'}]}
        params={{orgId: org.slug, group: group.id, eventId: '1'}}
        location={{}}
      />,
      routerContext
    );
    await tick();
    expect(browserHistory.replace).not.toHaveBeenCalled();
    wrapper.setProps({environments: []});
    await tick();

    expect(browserHistory.replace).not.toHaveBeenCalled();
  });

  it('next/prev links', async function () {
    event = TestStubs.Event({
      size: 1,
      dateCreated: '2019-03-20T00:00:00.000Z',
      errors: [],
      entries: [],
      tags: [{key: 'environment', value: 'dev'}],
      previousEventID: 'prev-event-id',
      nextEventID: 'next-event-id',
    });

    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/events/1/`,
      body: event,
    });

    const wrapper = mountWithTheme(
      <GroupEventDetails
        api={new MockApiClient()}
        group={group}
        event={event}
        project={project}
        organization={org}
        environments={[{id: '1', name: 'dev', displayName: 'Dev'}]}
        params={{orgId: org.slug, groupId: group.id, eventId: '1'}}
        location={{query: {environment: 'dev'}}}
      />,
      routerContext
    );
    await tick();

    wrapper.update();

    const buttons = wrapper.find('GroupEventToolbar').find('ButtonBar').find('Button');

    expect(buttons.at(0).prop('to')).toEqual({
      pathname: '/organizations/org-slug/issues/1/events/oldest/',
      query: {environment: 'dev'},
    });

    expect(buttons.at(1).prop('to')).toEqual({
      pathname: '/organizations/org-slug/issues/1/events/prev-event-id/',
      query: {environment: 'dev'},
    });
    expect(buttons.at(2).prop('to')).toEqual({
      pathname: '/organizations/org-slug/issues/1/events/next-event-id/',
      query: {environment: 'dev'},
    });
    expect(buttons.at(3).prop('to')).toEqual({
      pathname: '/organizations/org-slug/issues/1/events/latest/',
      query: {environment: 'dev'},
    });
  });

  it('displays error on event error', async function () {
    const wrapper = mountWithTheme(
      <GroupEventDetails
        api={new MockApiClient()}
        group={group}
        event={undefined}
        eventError
        project={project}
        organization={org}
        environments={[{id: '1', name: 'dev', displayName: 'Dev'}]}
        params={{orgId: org.slug, group: group.id, eventId: '1'}}
        location={{}}
      />,
      routerContext
    );
    await tick();

    expect(wrapper.text()).toContain('events for this issue could not be found');
  });

  describe('project low priority queue alert', function () {
    it('does not render alert', function () {
      const proj = TestStubs.Project({
        eventProcessing: {
          symbolicationDegraded: false,
        },
      });

      const wrapper = mountWithTheme(
        <GroupEventDetails
          api={new MockApiClient()}
          group={group}
          project={proj}
          organization={org}
          event={event}
          environments={[{id: '1', name: 'dev', displayName: 'Dev'}]}
          groupReprocessingStatus={ReprocessingStatus.NO_STATUS}
          loadingEvent={false}
          eventError={false}
          onRetry={jest.fn()}
          location={{query: {environment: 'dev'}}}
        />,
        routerContext
      );

      expect(wrapper.find('StyledGlobalEventProcessingAlert').exists()).toBe(false);
    });

    it('renders alert', function () {
      const proj = TestStubs.Project({
        eventProcessing: {
          symbolicationDegraded: true,
        },
      });

      const wrapper = mountWithTheme(
        <GroupEventDetails
          api={new MockApiClient()}
          group={group}
          project={proj}
          organization={org}
          environments={[{id: '1', name: 'dev', displayName: 'Dev'}]}
          event={event}
          groupReprocessingStatus={ReprocessingStatus.NO_STATUS}
          loadingEvent={false}
          eventError={false}
          onRetry={jest.fn()}
          location={{query: {environment: 'dev'}}}
        />,
        routerContext
      );

      const eventProcessingAlert = wrapper.find('StyledGlobalEventProcessingAlert');
      expect(eventProcessingAlert.exists()).toBe(true);
      expect(eventProcessingAlert.text()).toBe(
        'Event Processing for this project is currently degraded. Events may appear with larger delays than usual or get dropped. Please check the Status page for a potential outage.'
      );
    });
  });

  describe('EventCauseEmpty', () => {
    const proj = TestStubs.Project({firstEvent: '2020-01-01T01:00:00Z'});

    it('renders empty state', async function () {
      MockApiClient.addMockResponse({
        url: `/projects/${org.slug}/${project.slug}/releases/completion/`,
        body: [
          {
            step: 'commit',
            complete: false,
          },
        ],
      });

      const wrapper = mountWithTheme(
        <GroupEventDetails
          api={new MockApiClient()}
          group={group}
          event={event}
          project={proj}
          organization={org}
          environments={[{id: '1', name: 'dev', displayName: 'Dev'}]}
          params={{orgId: org.slug, groupId: group.id, eventId: '1'}}
          location={{query: {environment: 'dev'}}}
        />,
        routerContext
      );
      await tick();
      wrapper.update();

      expect(wrapper.find('EventCause').exists()).toBe(false);
      expect(wrapper.find('EventCauseEmpty').exists()).toBe(true);
    });

    it('renders suspect commit', async function () {
      MockApiClient.addMockResponse({
        url: `/projects/${org.slug}/${project.slug}/releases/completion/`,
        body: [
          {
            step: 'commit',
            complete: true,
          },
        ],
      });

      const wrapper = mountWithTheme(
        <GroupEventDetails
          api={new MockApiClient()}
          group={group}
          event={event}
          project={proj}
          organization={org}
          environments={[{id: '1', name: 'dev', displayName: 'Dev'}]}
          params={{orgId: org.slug, groupId: group.id, eventId: '1'}}
          location={{query: {environment: 'dev'}}}
        />,
        routerContext
      );
      await tick();
      wrapper.update();

      expect(wrapper.find('EventCause').exists()).toBe(true);
      expect(wrapper.find('EventCauseEmpty').exists()).toBe(false);
    });

    it('renders suspect commit if `releasesCompletion` empty', async function () {
      MockApiClient.addMockResponse({
        url: `/projects/${org.slug}/${project.slug}/releases/completion/`,
        body: [],
      });

      const wrapper = mountWithTheme(
        <GroupEventDetails
          api={new MockApiClient()}
          group={group}
          event={event}
          project={proj}
          organization={org}
          environments={[{id: '1', name: 'dev', displayName: 'Dev'}]}
          params={{orgId: org.slug, groupId: group.id, eventId: '1'}}
          location={{query: {environment: 'dev'}}}
        />,
        routerContext
      );

      await tick();
      wrapper.update();

      expect(wrapper.find('EventCause').exists()).toBe(true);
      expect(wrapper.find('EventCauseEmpty').exists()).toBe(false);
    });

    it('renders suspect commit if `releasesCompletion` null', async function () {
      MockApiClient.addMockResponse({
        url: `/projects/${org.slug}/${project.slug}/releases/completion/`,
        body: null,
      });

      const wrapper = mountWithTheme(
        <GroupEventDetails
          api={new MockApiClient()}
          group={group}
          event={event}
          project={proj}
          organization={org}
          environments={[{id: '1', name: 'dev', displayName: 'Dev'}]}
          params={{orgId: org.slug, groupId: group.id, eventId: '1'}}
          location={{query: {environment: 'dev'}}}
        />,
        routerContext
      );
      await tick();
      wrapper.update();

      expect(wrapper.find('EventCause').exists()).toBe(true);
      expect(wrapper.find('EventCauseEmpty').exists()).toBe(false);
    });
  });

  describe('Platform Integrations', () => {
    let wrapper; // eslint-disable-line
    let componentsRequest;

    const mountWithThemeWrapper = () =>
      mountWithTheme(
        <GroupEventDetails
          api={new MockApiClient()}
          group={group}
          event={event}
          project={project}
          organization={org}
          environments={[{id: '1', name: 'dev', displayName: 'Dev'}]}
          params={{orgId: org.slug, groupId: group.id, eventId: '1'}}
          location={{query: {environment: 'dev'}}}
        />,
        routerContext
      );

    beforeEach(() => {
      const unpublishedIntegration = TestStubs.SentryApp({status: 'unpublished'});
      const internalIntegration = TestStubs.SentryApp({status: 'internal'});

      const unpublishedInstall = TestStubs.SentryAppInstallation({
        app: {
          slug: unpublishedIntegration.slug,
          uuid: unpublishedIntegration.uuid,
        },
      });

      const internalInstall = TestStubs.SentryAppInstallation({
        app: {
          slug: internalIntegration.slug,
          uuid: internalIntegration.uuid,
        },
      });

      const component = TestStubs.SentryAppComponent({
        sentryApp: {
          uuid: unpublishedIntegration.uuid,
          slug: unpublishedIntegration.slug,
          name: unpublishedIntegration.name,
        },
      });

      MockApiClient.clearMockResponses();
      mockGroupApis();

      componentsRequest = MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/sentry-app-components/?projectId=${project.id}`,
        body: [component],
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/sentry-app-installations/`,
        body: [unpublishedInstall, internalInstall],
      });

      mountWithThemeWrapper();
    });

    it('loads Integration UI components', () => {
      expect(componentsRequest).toHaveBeenCalled();
    });
  });
});
