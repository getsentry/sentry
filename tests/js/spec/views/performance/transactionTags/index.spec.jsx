import {browserHistory} from 'react-router';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import ProjectsStore from 'app/stores/projectsStore';
import TransactionTags from 'app/views/performance/transactionSummary/transactionTags';

function initializeData({query} = {query: {}}) {
  const features = ['discover-basic', 'performance-view', 'performance-tag-page'];
  const organization = TestStubs.Organization({
    features,
    projects: [TestStubs.Project()],
  });
  const initialData = initializeOrg({
    organization,
    router: {
      location: {
        query: {
          transaction: 'Test Transaction',
          project: 1,
          ...query,
        },
      },
    },
  });
  ProjectsStore.loadInitialData(initialData.organization.projects);
  return initialData;
}

describe('Performance > Transaction Tags', function () {
  beforeEach(function () {
    browserHistory.push = jest.fn();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/user.email/values/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-facets-performance/',
      body: {
        meta: {
          tags_key: 'string',
          tags_value: 'string',
          sumdelta: 'duration',
          count: 'integer',
          frequency: 'number',
          comparison: 'number',
          aggregate: 'number',
        },
        data: [
          {
            tags_key: 'hardwareConcurrency',
            tags_value: '4',
            sumdelta: 45773.0,
            count: 83,
            frequency: 0.05,
            comparison: 1.45,
            aggregate: 2000.5,
          },
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-facets-performance-histogram/',
      body: {
        meta: {
          count: 'integer',
          histogram_measurements_lcp_120_360_1: 'number',
          tags_key: 'string',
          tags_value: 'string',
        },
        data: [
          {
            histogram_measurements_lcp_120_360_1: 600,
            tags_value: '4',
            tags_key: 'hardwareConcurrency',
            count: 3,
          },
        ],
      },
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
  });

  it('renders basic UI elements', async function () {
    const initialData = initializeData();
    const wrapper = mountWithTheme(
      <TransactionTags
        organization={initialData.organization}
        location={initialData.router.location}
      />,
      initialData.routerContext
    );

    await tick();
    wrapper.update();

    // It shows the sidebar
    expect(wrapper.find('TagsPageContent')).toHaveLength(1);

    // It shows the header
    expect(wrapper.find('TransactionHeader')).toHaveLength(1);

    // It shows the tag display
    expect(wrapper.find('TagsDisplay')).toHaveLength(1);

    // It shows the tag chart
    expect(wrapper.find('TagsHeatMap')).toHaveLength(1);

    // It shows a table
    expect(wrapper.find('GridEditable')).toHaveLength(1);
  });
});
