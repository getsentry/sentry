import {browserHistory} from 'react-router';
import React from 'react';

import {mount, shallow} from 'enzyme';

import GroupSimilar from 'app/views/groupDetails/shared/groupSimilar';
import issues from 'app-test/mocks/issues';

const project = TestStubs.Project({
  features: ['similarity-view'],
});

const routerContext = TestStubs.routerContext([
  {
    router: {
      ...TestStubs.router(),
      params: {orgId: 'org-slug', projectId: 'project-slug', groupId: 'group-id'},
    },
  },
]);

const scores = [
  {'exception:stacktrace:pairs': 0.375},
  {'exception:stacktrace:pairs': 0.01264},
  {'exception:stacktrace:pairs': 0.875},
  {
    'exception:stacktrace:application-chunks': 0.000235,
    'exception:stacktrace:pairs': 0.001488,
  },
];

const mockData = {
  similar: issues.map((issue, i) => [issue, scores[i]]),
};

describe('Issues Similar View', function() {
  let mock;
  beforeEach(function() {
    mock = MockApiClient.addMockResponse({
      url: '/issues/group-id/similar/?limit=50',
      body: mockData.similar,
    });
  });

  it('renders initially with loading component', function() {
    let component = shallow(
      <GroupSimilar project={project} params={{groupId: 'group-id'}} location={{}} />,
      routerContext
    );

    expect(component).toMatchSnapshot();
  });

  it('renders with mocked data', async function() {
    let wrapper = mount(
      <GroupSimilar
        project={project}
        query={''}
        params={{orgId: 'org-slug', projectId: 'project-slug', groupId: 'group-id'}}
        location={{}}
      />,
      routerContext
    );

    await tick();
    await tick();
    wrapper.update();
    expect(mock).toHaveBeenCalled();
    expect(wrapper.find('GroupGroupingView')).toMatchSnapshot();
  });

  it('can merge and redirect to new parent', async function() {
    let wrapper = mount(
      <GroupSimilar
        project={project}
        params={{orgId: 'org-slug', projectId: 'project-slug', groupId: 'group-id'}}
        location={{}}
      />,
      routerContext
    );
    let merge = MockApiClient.addMockResponse({
      method: 'PUT',
      url: '/projects/org-slug/project-slug/issues/',
      body: {
        merge: {children: ['123'], parent: '321'},
      },
    });

    await tick();
    await tick();
    wrapper.update();

    wrapper
      .find('[data-test-id="similar-item-row"]')
      .first()
      .simulate('click');

    await tick();
    wrapper.update();
    wrapper.find('[data-test-id="merge"] a').simulate('click');
    wrapper.find('Button[data-test-id="confirm-modal"]').simulate('click');

    await tick();
    wrapper.update();

    expect(merge).toHaveBeenCalledWith(
      '/projects/org-slug/project-slug/issues/',
      expect.objectContaining({
        data: {merge: 1},
      })
    );

    expect(browserHistory.push).toHaveBeenCalledWith(
      '/org-slug/project-slug/issues/321/similar/'
    );
  });
});
