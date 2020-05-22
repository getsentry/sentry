import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import {ErrorRobot} from 'app/components/errorRobot';

describe('ErrorRobot', function() {
  let getIssues;

  beforeEach(function() {
    Client.clearMockResponses();
    getIssues = Client.addMockResponse({
      url: '/projects/org-slug/project-slug/issues/',
      method: 'GET',
      body: [],
    });
  });

  describe('with a project', function() {
    let wrapper;
    beforeEach(function() {
      wrapper = mountWithTheme(
        <ErrorRobot
          api={new MockApiClient()}
          org={TestStubs.Organization()}
          project={TestStubs.Project()}
        />,
        TestStubs.routerContext()
      );
    });

    it('Renders a button for creating an event', function() {
      const button = wrapper.find('Button[data-test-id="create-sample-event"]');
      expect(button.exists).toBeTruthy();
      expect(button.props().disabled).toBeFalsy();
      expect(getIssues).toHaveBeenCalled();
    });

    it('Renders installation instructions', function() {
      const button = wrapper.find('Button[priority="primary"]');
      expect(button).toHaveLength(1);
      expect(button.props().to).toEqual(expect.stringContaining('getting-started'));
    });
  });

  describe('without a project', function() {
    let wrapper;

    beforeEach(function() {
      wrapper = mountWithTheme(
        <ErrorRobot api={new MockApiClient()} org={TestStubs.Organization()} />,
        TestStubs.routerContext()
      );
    });

    it('Renders a disabled create event button', function() {
      const button = wrapper.find('Button[data-test-id="create-sample-event"]');
      expect(button.exists).toBeTruthy();
      expect(button.props().disabled).toBeTruthy();
      expect(getIssues).toHaveBeenCalledTimes(0);
    });

    it('does not display install instructions', function() {
      const button = wrapper.find('Button[priority="primary"]');
      expect(button).toHaveLength(0);
    });
  });
});
