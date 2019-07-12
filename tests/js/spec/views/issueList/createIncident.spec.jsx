import {browserHistory} from 'react-router';
import React from 'react';

import {initializeOrg} from 'app-test/helpers/initializeOrg';
import {mount} from 'enzyme';
import GlobalModal from 'app/components/globalModal';
import IssueListWithStores from 'app/views/issueList/overview';
import TagStore from 'app/stores/tagStore';

jest.mock('app/views/issueList/sidebar', () => jest.fn(() => null));

describe('IssueList --> Create Incident', function() {
  let wrapper;

  const {project, router, routerContext} = initializeOrg({
    organization: {
      features: ['global-views', 'incidents'],
      access: ['releases'],
      slug: 'org-slug',
    },
    router: {
      location: {query: {}, search: ''},
      params: {orgId: 'org-slug'},
    },
  });
  const defaultProps = {};

  const group = TestStubs.Group({project});
  const savedSearch = TestStubs.Search({
    id: '789',
    query: 'is:unresolved',
    name: 'Unresolved Issues',
    projectId: project.id,
  });

  TagStore.init();

  const createWrapper = ({params, location, ...p} = {}) => {
    const newRouter = {
      ...router,
      params: {
        ...router.params,
        ...params,
      },
      location: {
        ...router.location,
        ...location,
      },
    };

    wrapper = mount(
      <div>
        <GlobalModal />
        <IssueListWithStores {...newRouter} {...defaultProps} {...p} />
      </div>,
      routerContext
    );
  };

  beforeEach(function() {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/searches/',
      body: [savedSearch],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/processingissues/',
      method: 'GET',
      body: [
        {
          project: 'test-project',
          numIssues: 1,
          hasIssues: true,
          lastSeen: '2019-01-16T15:39:11.081Z',
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      method: 'GET',
      body: TestStubs.Tags(),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      method: 'GET',
      body: [TestStubs.Member({projects: [project.slug]})],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/searches/',
      body: [savedSearch],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      body: [
        group,
        TestStubs.Group({
          id: '2',
        }),
      ],
    });
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
    if (wrapper) {
      wrapper.unmount();
    }
    wrapper = null;
  });

  it('creates an incident by selecting issues from stream', async function() {
    const createIncident = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/incidents/',
      method: 'POST',
      body: {
        identifier: '468',
      },
    });
    createWrapper({
      selection: {
        projects: [123],
        environments: ['prod'],
        datetime: {},
      },
      location: {query: {project: ['123'], environment: ['prod']}},
    });

    await tick();
    await tick();
    wrapper.update();

    // Select checkboxes
    wrapper
      .find('GroupCheckbox')
      .at(0)
      .simulate('click');
    wrapper
      .find('GroupCheckbox')
      .at(1)
      .simulate('click');

    wrapper
      .find('[data-test-id="create-incident"]')
      .at(0)
      .simulate('click');

    // Needs two ticks, one for reflux and one for dynamic import maybe? idk
    await tick();
    await tick();
    wrapper.update();

    wrapper
      .find('input[name="title"]')
      .simulate('change', {target: {value: 'New Incident'}})
      .simulate('blur');

    wrapper.find('Form').simulate('submit');

    expect(createIncident).toHaveBeenCalledWith(
      '/organizations/org-slug/incidents/',
      expect.objectContaining({
        data: {
          groups: ['1', '2'],
          query: '',
          title: 'New Incident',
        },
      })
    );

    // form model submitting requires this?
    await tick();
    wrapper.update();

    // redirect to details
    expect(browserHistory.push).toHaveBeenCalledWith(
      '/organizations/org-slug/incidents/468/'
    );
  });
});
