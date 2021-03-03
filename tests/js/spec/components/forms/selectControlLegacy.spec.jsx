import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {selectByValue} from 'sentry-test/select';

import {Form, SelectField} from 'app/components/forms';

describe('SelectField', function () {
  describe('deprecatedSelectControl', function () {
    it('renders without form context', function () {
      const wrapper = mountWithTheme(
        <SelectField
          deprecatedSelectControl
          options={[
            {label: 'a', value: 'a'},
            {label: 'b', value: 'b'},
          ]}
          name="fieldName"
          value="a"
        />
      );
      expect(wrapper).toSnapshot();
    });

    it('renders with flat choices', function () {
      const wrapper = mountWithTheme(
        <SelectField
          deprecatedSelectControl
          choices={['a', 'b', 'c']}
          name="fieldName"
        />,
        {
          context: {
            form: {
              data: {
                fieldName: 'fieldValue',
              },
              errors: {},
            },
          },
        }
      );
      expect(wrapper).toSnapshot();
    });

    it('renders with paired choices', function () {
      const wrapper = mountWithTheme(
        <SelectField
          deprecatedSelectControl
          choices={[
            ['a', 'abc'],
            ['b', 'bcd'],
            ['c', 'cde'],
          ]}
          name="fieldName"
        />,
        {
          context: {
            form: {
              data: {
                fieldName: 'fieldValue',
              },
              errors: {},
            },
          },
        }
      );
      expect(wrapper).toSnapshot();
    });

    it('can change value and submit', function () {
      const mock = jest.fn();
      const wrapper = mountWithTheme(
        <Form onSubmit={mock}>
          <SelectField
            deprecatedSelectControl
            options={[
              {label: 'a', value: 'a'},
              {label: 'b', value: 'b'},
            ]}
            name="fieldName"
          />
        </Form>
      );
      selectByValue(wrapper, 'a', {name: 'fieldName'});
      wrapper.find('Form').simulate('submit');
      expect(mock).toHaveBeenCalledWith(
        {fieldName: 'a'},
        expect.anything(),
        expect.anything()
      );
    });

    describe('Multiple', function () {
      it('selects multiple values and submits', function () {
        const mock = jest.fn();
        const wrapper = mountWithTheme(
          <Form onSubmit={mock}>
            <SelectField
              deprecatedSelectControl
              multiple
              options={[
                {label: 'a', value: 'a'},
                {label: 'b', value: 'b'},
              ]}
              name="fieldName"
            />
          </Form>
        );
        selectByValue(wrapper, 'a', {name: 'fieldName'});
        wrapper.find('Form').simulate('submit');
        expect(mock).toHaveBeenCalledWith(
          {fieldName: ['a']},
          expect.anything(),
          expect.anything()
        );
      });
    });
  });
});
