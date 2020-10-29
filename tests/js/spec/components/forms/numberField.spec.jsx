import React from 'react';

import {mountWithTheme, mount} from 'sentry-test/enzyme';

import {NumberField} from 'app/components/forms';
import Form from 'app/components/forms/form';

jest.mock('jquery');

describe('NumberField', function () {
  describe('render()', function () {
    it('renders', function () {
      const wrapper = mountWithTheme(<NumberField name="fieldName" />);
      expect(wrapper).toSnapshot();
    });

    it('renders with optional attributes', function () {
      const wrapper = mountWithTheme(<NumberField name="fieldName" min={0} max={100} />);
      expect(wrapper).toSnapshot();
    });

    it('renders with value', function () {
      const wrapper = mountWithTheme(<NumberField name="fieldName" value={5} />);
      expect(wrapper).toSnapshot();
    });

    it('renders with form context', function () {
      const wrapper = mountWithTheme(<NumberField name="fieldName" />, {
        context: {
          form: {
            data: {
              fieldName: 5,
            },
            errors: {},
          },
        },
      });
      expect(wrapper).toSnapshot();
    });

    it('doesnt save `NaN` when new value is empty string', function () {
      const wrapper = mount(
        <Form onSubmit={() => {}}>
          <NumberField name="fieldName" defaultValue="2" />
        </Form>
      );
      wrapper.find('input').simulate('change', {target: {value: ''}});
      expect(wrapper.state('data').fieldName).toBe('');
    });
  });
});
