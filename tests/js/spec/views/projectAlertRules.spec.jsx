import React from 'react';
import {mount} from 'enzyme';

import ProjectAlertRules from 'app/views/settings/projectAlerts/projectAlertRules';

describe('projectAlertRules', function() {
  let deleteMock;
  beforeEach(function() {
    MockApiClient.addMockResponse({
      url: '/projects/org1/project1/rules/',
      body: [TestStubs.ProjectAlertRule()],
    });

    deleteMock = MockApiClient.addMockResponse({
      method: 'DELETE',
      url: '/projects/org1/project1/rules/1/',
      body: {},
    });
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  it('renders', function() {
    const wrapper = mount(
      <ProjectAlertRules routes={[]} params={{orgId: 'org1', projectId: 'project1'}} />,
      TestStubs.routerContext()
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('deletes', function() {
    const wrapper = mount(
      <ProjectAlertRules routes={[]} params={{orgId: 'org1', projectId: 'project1'}} />,
      TestStubs.routerContext()
    );

    wrapper.find('Confirm').simulate('click');
    wrapper.update();
    wrapper.find('Modal Button[priority="primary"]').simulate('click');
    expect(deleteMock).toHaveBeenCalled();
  });

  it('has disabled edit rule button without access', function() {
    const wrapper = mount(
      <ProjectAlertRules routes={[]} params={{orgId: 'org1', projectId: 'project1'}} />,
      TestStubs.routerContext([{organization: TestStubs.Organization({access: []})}])
    );

    expect(wrapper.find('Button[data-test-id="edit-rule"]').prop('disabled')).toBe(true);
  });
});
