import React from 'react';

import {shallow} from 'sentry-test/enzyme';

import DiffModal from 'app/components/modals/diffModal';

describe('DiffModal', function() {
  beforeEach(function() {});

  afterEach(function() {});

  it('renders', function() {
    const wrapper = shallow(<DiffModal Body={({children}) => <div>{children}</div>} />);
    expect(wrapper).toMatchSnapshot();
  });
});
