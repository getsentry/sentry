import React from 'react';
import {shallow, mount} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import ProjectDebugFiles from 'app/views/settings/projectDebugFiles';

const ENDPOINT = '/projects/org/project/files/dsyms/';

describe('ProjectDebugFiles', function() {
  beforeEach(function() {
    Client.clearMockResponses();
    Client.addMockResponse({
      url: '/projects/org/project/',
      body: {},
    });
  });

  it('renders empty', function() {
    Client.addMockResponse({
      url: ENDPOINT,
      body: [],
    });
    const wrapper = shallow(
      <ProjectDebugFiles
        params={{orgId: 'org', projectId: 'project'}}
        location={{query: {}}}
      />,
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

    const wrapper = mount(
      <ProjectDebugFiles
        params={{orgId: 'org', projectId: 'project'}}
        location={{query: {}}}
      />,
      TestStubs.routerContext()
    );

    expect(wrapper).toMatchSnapshot();
  });
});
