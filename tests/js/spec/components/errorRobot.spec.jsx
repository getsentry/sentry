import React from 'react';
import {browserHistory} from 'react-router';
import {shallow} from 'enzyme';
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
      wrapper = shallow(
        <ErrorRobot
          api={new MockApiClient()}
          org={TestStubs.Organization()}
          project={TestStubs.Project()}
        />
      );
    });

    it('Renders a button for creating an event', function() {
      const button = wrapper.find('Button[priority="link"]');
      expect(button).toHaveLength(1);
      expect(button.props().onClick).toBeDefined();
      expect(button.props().disabled).toBeFalsy();
      expect(getIssues).toHaveBeenCalled();
    });

    it('Renders installation instructions', function() {
      const button = wrapper.find('Button[priority="primary"]');
      expect(button).toHaveLength(1);
      expect(button.props().to).toEqual(expect.stringContaining('getting-started'));
    });

    it('can create a sample event', async function() {
      Client.addMockResponse({
        url: '/projects/org-slug/project-slug/create-sample/',
        method: 'POST',
        body: {groupID: 999},
      });
      wrapper.find('Button[priority="link"]').simulate('click');
      await wrapper.update();

      expect(browserHistory.push).toHaveBeenCalled();
    });
  });

  describe('without a project', function() {
    let wrapper;

    beforeEach(function() {
      wrapper = shallow(
        <ErrorRobot api={new MockApiClient()} org={TestStubs.Organization()} />
      );
    });

    it('Renders a disabled create event button', function() {
      const button = wrapper.find('Button[priority="link"]');
      expect(button).toHaveLength(1);
      expect(button.props().disabled).toBeTruthy();
      expect(getIssues).toHaveBeenCalledTimes(0);
    });

    it('does not display install instructions', function() {
      const button = wrapper.find('Button[priority="primary"]');
      expect(button).toHaveLength(0);
    });
  });
});
