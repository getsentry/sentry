import React from 'react';
import PropTypes from 'prop-types';
import {mount} from 'enzyme';

import ProjectEnvironments from 'app/views/projectEnvironments';

import EnvironmentStore from 'app/stores/environmentStore';

function mountComponent(isHidden) {
  const org = TestStubs.Organization();
  const project = TestStubs.Project();
  let path = isHidden ? 'environments/hidden/' : 'environments/';
  return mount(
    <ProjectEnvironments
      params={{
        orgId: org.slug,
        projectId: project.slug,
      }}
      route={{path}}
    />,
    {
      context: {
        router: TestStubs.router(),
      },
      childContextTypes: {
        router: PropTypes.object,
      },
    }
  );
}

describe('ProjectEnvironments', function() {
  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  describe('render active', function() {
    it('renders empty message', function() {
      EnvironmentStore.loadInitialData([]);
      const wrapper = mountComponent(false);
      expect(wrapper.text()).toContain("You don't have any environments yet");
      expect(wrapper).toMatchSnapshot();
    });

    it('renders environment list', function() {
      EnvironmentStore.loadInitialData(TestStubs.Environments(false));
      const wrapper = mountComponent(false);
      expect(wrapper).toMatchSnapshot();
    });
  });

  describe('render hidden', function() {
    it('renders empty message', function() {
      EnvironmentStore.loadHiddenData([]);

      const wrapper = mountComponent(true);

      expect(wrapper.text()).toContain("You don't have any hidden environments");

      expect(wrapper).toMatchSnapshot();
    });

    it('renders environment list', function() {
      EnvironmentStore.loadHiddenData(TestStubs.Environments(true));
      const wrapper = mountComponent(true);

      expect(wrapper).toMatchSnapshot();
    });
  });

  describe('toggle', function() {
    let hideMock, showMock;
    const baseUrl = '/projects/org-slug/project-slug/environments/';
    beforeEach(function() {
      hideMock = MockApiClient.addMockResponse({
        url: `${baseUrl}production/`,
        method: 'PUT',
      });
      showMock = MockApiClient.addMockResponse({
        url: `${baseUrl}zzz/`,
        method: 'PUT',
      });

      MockApiClient.addMockResponse({
        url: baseUrl,
      });
    });
    it('hides', function() {
      EnvironmentStore.loadInitialData(TestStubs.Environments(false));
      const wrapper = mountComponent(false);
      wrapper
        .find('Button')
        .first()
        .simulate('click');
      expect(hideMock).toHaveBeenCalledWith(
        `${baseUrl}production/`,
        expect.objectContaining({
          data: expect.objectContaining({isHidden: true}),
        })
      );
    });

    it('shows', function() {
      EnvironmentStore.loadHiddenData(TestStubs.Environments(true));
      const wrapper = mountComponent(true);
      wrapper
        .find('Button')
        .first()
        .simulate('click');
      expect(showMock).toHaveBeenCalledWith(
        `${baseUrl}zzz/`,
        expect.objectContaining({
          data: expect.objectContaining({isHidden: false}),
        })
      );
    });
  });
});
