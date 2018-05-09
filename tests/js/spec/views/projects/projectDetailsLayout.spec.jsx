import React from 'react';
import {mount} from 'enzyme';

import {ProjectDetailsLayout} from 'app/views/projectDetailsLayout';
import {setLastRoute} from 'app/actionCreators/navigation';

jest.mock('app/actionCreators/navigation', () => ({
  setLastRoute: jest.fn(),
}));

jest.unmock('app/utils/recreateRoute');

describe('ProjectLayout', function() {
  it('calls `setLastRoute` when unmounting', function() {
    let wrapper = mount(
      <ProjectDetailsLayout location={{pathname: '/org-slug/dashboard/'}} />
    );

    wrapper.unmount();

    expect(setLastRoute).toHaveBeenCalledWith('/org-slug/dashboard/');
  });
});
