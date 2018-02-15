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
          context: {router: TestStubs.router()},
        }
      );
      expect(wrapper).toMatchSnapshot();
    });
  });

  describe('onSubmitSuccess()', function() {
    let wrapper;
    let redirectMock;

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
      redirectMock = jest.fn();
      wrapper.instance().redirect = redirectMock;
    });

    it('redirects to legacy team settings', function() {
      wrapper.instance().onSubmitSuccess({
        slug: 'new-team',
      });
      expect(redirectMock).toBeCalledWith(
        '/organizations/org/projects/new/?team=new-team'
      );
    });

    it('redirects to new team settings', function() {
      wrapper.setContext({
        organization: {
          id: '1337',
          features: ['internal-catchall'],
        },
      });
      wrapper.instance().onSubmitSuccess({
        slug: 'new-team',
      });
      expect(redirectMock).toBeCalledWith('/settings/organization/org/teams/new-team/');
    });
  });
});
