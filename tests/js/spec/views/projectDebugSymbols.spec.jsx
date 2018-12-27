import React from 'react';
import {shallow, mount} from 'enzyme';

import {Client} from 'app/api';
import ProjectDebugSymbols from 'app/views/projectDebugSymbols';

const ENDPOINT = '/projects/org/project/files/dsyms/';

describe('ProjectDebugSymbols', function() {
  beforeEach(function() {
    Client.clearMockResponses();
  });

  it('renders empty', function() {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [],
    });
    let wrapper = shallow(
      <ProjectDebugSymbols params={{orgId: 'org', projectId: 'project'}} />,
      TestStubs.routerContext()
    );

    expect(wrapper).toMatchSnapshot();
  });

  it('renders', function() {
    Client.addMockResponse({
      url: ENDPOINT,
      body: TestStubs.DebugSymbols(),
    });
    Client.addMockResponse({
      url: ENDPOINT,
      method: 'PUT',
    });

    let wrapper = mount(
      <ProjectDebugSymbols params={{orgId: 'org', projectId: 'project'}} />,
      TestStubs.routerContext()
    );

    expect(wrapper).toMatchSnapshot();
  });
});
