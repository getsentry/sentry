import {EventFixture} from 'sentry-fixture/event';
import {EventEntryStacktraceFixture} from 'sentry-fixture/eventEntryStacktrace';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import HookStore from 'sentry/stores/hookStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {EventOrGroupType} from 'sentry/types/event';
import type {StacktraceType} from 'sentry/types/stacktrace';
import * as analytics from 'sentry/utils/analytics';

import {StacktraceBanners} from './stacktraceBanners';

describe('StacktraceBanners', () => {
  const org = OrganizationFixture({
    features: ['codecov-integration'],
  });
  const project = ProjectFixture();

  const eventEntryStacktrace = EventEntryStacktraceFixture();
  const inAppFrame = eventEntryStacktrace.data.frames![0]!;
  inAppFrame.inApp = true;
  const event = EventFixture({
    projectID: project.id,
    entries: [eventEntryStacktrace],
    type: EventOrGroupType.ERROR,
  });
  const stacktrace = eventEntryStacktrace.data as Required<StacktraceType>;

  const analyticsSpy = jest.spyOn(analytics, 'trackAnalytics');
  let promptActivity: jest.Mock;
  let promptsUpdateMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
    promptActivity = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${org.slug}/prompts-activity/`,
      body: {},
    });
    promptsUpdateMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      method: 'PUT',
    });
    ProjectsStore.loadInitialData([project]);
    HookStore.init?.();
  });

  it('renders nothing with no in app frames', () => {
    const {container} = render(
      <StacktraceBanners stacktrace={EventEntryStacktraceFixture().data} event={event} />,
      {
        organization: org,
      }
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders add integration and allows dismissing', async () => {
    const stacktraceLinkMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      body: {config: null, sourceUrl: null, integrations: []},
    });
    const {container} = render(
      <StacktraceBanners stacktrace={stacktrace} event={event} />,
      {
        organization: org,
      }
    );
    expect(await screen.findByText('Connect with Git Providers')).toBeInTheDocument();
    expect(stacktraceLinkMock).toHaveBeenCalledTimes(1);
    expect(stacktraceLinkMock).toHaveBeenCalledWith(
      `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      expect.objectContaining({
        query: {
          file: inAppFrame.filename,
          absPath: inAppFrame.absPath,
          commitId: event.release?.lastCommit?.id,
          lineNo: inAppFrame.lineNo,
          module: inAppFrame.module,
          platform: undefined,
          groupId: event.groupID,
        },
      })
    );
    expect(promptActivity).toHaveBeenCalledTimes(1);
    expect(promptActivity).toHaveBeenCalledWith(
      `/organizations/${org.slug}/prompts-activity/`,
      expect.objectContaining({
        query: {
          feature: 'stacktrace_link',
          organization_id: org.id,
          project_id: project.id,
        },
      })
    );

    await userEvent.click(screen.getByRole('button', {name: 'Dismiss'}));
    expect(container).toBeEmptyDOMElement();

    expect(analyticsSpy).toHaveBeenCalledTimes(1);
    expect(promptsUpdateMock).toHaveBeenCalledTimes(1);
    expect(promptsUpdateMock).toHaveBeenCalledWith(
      '/organizations/org-slug/prompts-activity/',
      expect.objectContaining({
        data: {
          feature: 'stacktrace_link',
          organization_id: org.id,
          project_id: project.id,
          status: 'dismissed',
        },
      })
    );
  });
});
