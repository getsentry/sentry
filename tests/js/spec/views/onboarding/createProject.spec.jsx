import React from 'react';
import {shallow, mount} from 'enzyme';

import CreateProject from 'app/views/onboarding/createProject';
import {openCreateTeamModal} from 'app/actionCreators/modal';

jest.mock('app/actionCreators/modal');

describe('CreateProject', function() {
  const baseProps = {
    location: {query: {}},
    params: {
      projectId: '',
      orgId: 'testOrg',
    },
  };

  it('should block if you have access to no teams', function() {
    let props = {
      ...baseProps,
    };

    let wrapper = shallow(
      <CreateProject {...props} />,
      TestStubs.routerContext([
        {
          organization: {
            id: '1',
            slug: 'testOrg',
            teams: [{slug: 'test', id: '1', name: 'test', hasAccess: false}],
          },
          location: {query: {}},
        },
      ])
    );

    expect(wrapper).toMatchSnapshot();
  });

  it('can create a new team if no access to teams', function() {
    let props = {
      ...baseProps,
    };

    let wrapper = mount(
      <CreateProject {...props} />,
      TestStubs.routerContext([
        {
          organization: {
            id: '1',
            slug: 'testOrg',
            teams: [{slug: 'test', id: '1', name: 'test', hasAccess: false}],
          },
        },
      ])
    );

    wrapper.find('CreateTeamBody Button').simulate('click');
    expect(openCreateTeamModal).toHaveBeenCalled();
  });

  it('should fill in project name if its empty when platform is chosen', function() {
    let props = {
      ...baseProps,
    };

    let wrapper = mount(
      <CreateProject {...props} />,
      TestStubs.routerContext([
        {
          organization: {
            id: '1',
            slug: 'testOrg',
            teams: [{slug: 'test', id: '1', name: 'test', hasAccess: true}],
          },
          location: {query: {}},
        },
      ])
    );

    let node = wrapper.find('PlatformCard').first();
    node.simulate('click');
    expect(wrapper.state().projectName).toBe('C#');

    node = wrapper.find('PlatformCard').last();
    node.simulate('click');
    expect(wrapper.state().projectName).toBe('Ruby');

    //but not replace it when project name is something else:
    wrapper.setState({projectName: 'another'});

    node = wrapper.find('PlatformCard').first();
    node.simulate('click');
    expect(wrapper.state().projectName).toBe('another');

    expect(wrapper).toMatchSnapshot();
  });

  it('should fill in platform name if its provided by url', function() {
    let props = {
      ...baseProps,
    };

    let wrapper = mount(
      <CreateProject {...props} />,
      TestStubs.routerContext([
        {
          organization: {
            id: '1',
            slug: 'testOrg',
            teams: [{slug: 'test', id: '1', name: 'test', hasAccess: true}],
          },
          location: {query: {platform: 'ruby'}},
        },
      ])
    );

    expect(wrapper.state().projectName).toBe('Ruby');

    expect(wrapper).toMatchSnapshot();
  });

  it('should deal with incorrect platform name if its provided by url', function() {
    let props = {
      ...baseProps,
    };

    let wrapper = mount(
      <CreateProject {...props} />,
      TestStubs.routerContext([
        {
          organization: {
            id: '1',
            slug: 'testOrg',
            teams: [{slug: 'test', id: '1', name: 'test', hasAccess: true}],
          },
          location: {query: {platform: 'XrubyROOLs'}},
        },
      ])
    );

    expect(wrapper.state().projectName).toBe('');

    expect(wrapper).toMatchSnapshot();
  });
});
