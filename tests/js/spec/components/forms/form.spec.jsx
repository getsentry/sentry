import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {Form} from 'app/components/forms';

describe('Form', function() {
  describe('render()', function() {
    it('renders with children', function() {
      const wrapper = mountWithTheme(
        <Form onSubmit={() => {}}>
          <hr />
        </Form>
      );
      expect(wrapper).toSnapshot();
      expect(wrapper).toMatchSnapshot();
    });
  });
});
