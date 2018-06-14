import React from 'react';
import {mount, shallow} from 'enzyme';

import {Form, SelectField} from 'app/components/forms';

import {selectByValue} from '../../../helpers/select';

describe('SelectField', function() {
  it('renders without form context', function() {
    let wrapper = mount(
      <SelectField
        options={[{label: 'a', value: 'a'}, {label: 'b', value: 'b'}]}
        name="fieldName"
        value="a"
      />
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('renders with flat choices', function() {
    let wrapper = shallow(<SelectField choices={['a', 'b', 'c']} name="fieldName" />, {
      context: {
        form: {
          data: {
            fieldName: 'fieldValue',
          },
          errors: {},
        },
      },
    });
    expect(wrapper).toMatchSnapshot();
  });

  it('renders with paired choices', function() {
    let wrapper = shallow(
      <SelectField
        choices={[['a', 'abc'], ['b', 'bcd'], ['c', 'cde']]}
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
    expect(wrapper).toMatchSnapshot();
  });

  it('can change value and submit', function() {
    let mock = jest.fn();
    let wrapper = mount(
      <Form onSubmit={mock}>
        <SelectField
          options={[{label: 'a', value: 'a'}, {label: 'b', value: 'b'}]}
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
});
