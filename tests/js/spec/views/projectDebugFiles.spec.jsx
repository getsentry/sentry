import React from 'react';
import {shallow, mount} from 'enzyme';

import {Client} from 'app/api';
import ProjectDebugFiles from 'app/views/projectDebugFiles';

const ENDPOINT = '/projects/org/project/files/dsyms/';

describe('ProjectDebugFiles', function() {
  beforeEach(function() {
    Client.clearMockResponses();
  });

  it('renders empty', function() {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [],
    });
    let wrapper = shallow(
      <ProjectDebugFiles params={{orgId: 'org', projectId: 'project'}} />,
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
      <ProjectDebugFiles params={{orgId: 'org', projectId: 'project'}} />,
      TestStubs.routerContext()
    );

    expect(wrapper).toMatchSnapshot();
  });
});
