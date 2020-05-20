import React from 'react';

import {shallow} from 'sentry-test/enzyme';

import {Form} from 'app/components/forms';

describe('Form', function() {
  describe('render()', function() {
    it('renders with children', function() {
      const wrapper = shallow(
        <Form onSubmit={() => {}}>
          <hr />
        </Form>
      );
      expect(wrapper).toMatchSnapshot();
    });
  });
});
