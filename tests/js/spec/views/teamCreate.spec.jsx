import React from 'react';
import {shallow} from 'enzyme';

import TeamCreate from 'app/views/teamCreate';

describe('TeamCreate', function() {
  describe('render()', function() {
    it('renders correctly', function() {
      let wrapper = shallow(
        <TeamCreate
          params={{
            orgId: 'org',
          }}
        />,
        {
          context: {router: TestStubs.router(), organization: TestStubs.Organization()},
        }
      );
      expect(wrapper).toMatchSnapshot();
    });
  });

  describe('onSubmitSuccess()', function() {
    let wrapper;
    let locationAssignMock;

    beforeEach(function() {
      wrapper = shallow(
        <TeamCreate
          params={{
            orgId: 'org',
          }}
        />,
        {
          context: {
            router: TestStubs.router(),
            organization: {
              id: '1337',
            },
          },
        }
      );
      locationAssignMock = jest.fn();
      window.location.assign = locationAssignMock;
      wrapper.instance().redirect = locationAssignMock;
    });

    it('redirects to legacy team settings', function() {
      wrapper.instance().onSubmitSuccess({
        slug: 'new-team',
      });
      expect(locationAssignMock).toBeCalledWith(
        '/organizations/org/projects/new/?team=new-team'
      );
    });

    it('redirects to new team settings', function() {
      wrapper.setContext({
        organization: {
          id: '1337',
          features: ['new-teams'],
        },
      });
      wrapper.instance().onSubmitSuccess({
        slug: 'new-team',
      });
      expect(locationAssignMock).toBeCalledWith('/settings/org/teams/new-team/');
    });
  });
});
