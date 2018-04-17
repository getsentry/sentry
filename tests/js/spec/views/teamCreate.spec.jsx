import React from 'react';
import {shallow} from 'enzyme';

import {TeamCreate} from 'app/views/teamCreate';

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

  describe('handleSubmitSuccess()', function() {
    let wrapper;
    let redirectMock = jest.fn();

    beforeEach(function() {
      redirectMock.mockReset();
      wrapper = shallow(
        <TeamCreate
          router={{
            push: redirectMock,
          }}
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
    });

    it('redirects to legacy team settings', function() {
      wrapper.instance().handleSubmitSuccess({
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
          features: ['new-teams'],
        },
      });
      wrapper.instance().handleSubmitSuccess({
        slug: 'new-team',
      });
      expect(redirectMock).toBeCalledWith('/settings/org/teams/new-team/');
    });
  });
});
