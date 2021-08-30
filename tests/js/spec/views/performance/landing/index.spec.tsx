import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import {Project} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {PerformanceLanding} from 'app/views/performance/landing';
import {LandingDisplayField} from 'app/views/performance/landing/utils';

function initializeData(settings?: {
  query?: {};
  features?: string[];
  projects?: Project[];
  project?: Project;
}) {
  // @ts-expect-error
  const _defaultProject = TestStubs.Project();
  const _settings = {
    query: {},
    features: [],
    projects: [_defaultProject],
    project: _defaultProject,
    ...settings,
  };
  const {query, features} = _settings;

  // @ts-expect-error
  const projects = [TestStubs.Project()];
  const [project] = projects;

  // @ts-expect-error
  const organization = TestStubs.Organization({
    features,
    projects,
  });
  const router = {
    location: {
      query: {
        ...query,
      },
    },
  };
  const initialData = initializeOrg({organization, projects, project, router});
  return initialData;
}

const WrappedComponent = ({data}) => {
  const eventView = EventView.fromLocation(data.router.location);
  return (
    <PerformanceLanding
      organization={data.organization}
      location={data.router.location}
      eventView={eventView}
      projects={data.projects}
      shouldShowOnboarding={false}
      handleSearch={() => {}}
      handleTrendsClick={() => {}}
      setError={() => {}}
    />
  );
};

describe('Performance > Landing > Index', function () {
  beforeEach(function () {
    // @ts-expect-error
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sdk-updates/',
      body: [],
    });
    // @ts-expect-error
    MockApiClient.addMockResponse({
      url: '/prompts-activity/',
      body: {},
    });
    // @ts-expect-error
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/key-transactions-list/`,
      body: [],
    });
  });

  afterEach(function () {
    // @ts-expect-error
    MockApiClient.clearMockResponses();
  });

  it('renders basic UI elements', async function () {
    const data = initializeData();

    const wrapper = mountWithTheme(<WrappedComponent data={data} />, data.routerContext);
    // @ts-expect-error
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="performance-landing-v3"]').exists()).toBe(
      true
    );
  });

  it('renders frontend pageload view', async function () {
    const data = initializeData({
      query: {landingDisplay: LandingDisplayField.FRONTEND_PAGELOAD},
    });

    const wrapper = mountWithTheme(<WrappedComponent data={data} />, data.routerContext);
    // @ts-expect-error
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="frontend-pageload-view"]').exists()).toBe(
      true
    );
  });
});
