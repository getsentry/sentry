import React from 'react';
import {mount} from 'enzyme';

import GroupReleaseStats from 'app/components/group/releaseStats';

describe('GroupReleaseStats', function() {
  let component;
  beforeEach(function() {
    component = mount(
      <GroupReleaseStats group={TestStubs.Group()} location={TestStubs.location()} />,
      {
        context: {
          organization: TestStubs.Organization(),
          project: TestStubs.Project(),
          group: TestStubs.Group(),
        },
      }
    );
  });

  it('renders', function() {
    expect(component).toMatchSnapshot();
  });
});
