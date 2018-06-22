import React from 'react';
import {mount} from 'enzyme';

import {Form, SelectAsyncField} from 'app/components/forms';

describe('SelectAsyncField', function() {
  let api;

  beforeEach(function() {
    api = MockApiClient.addMockResponse({
      url: '/foo/bar/',
      query: {
        autocomplete_query: 'baz',
        autocomplete_field: 'fieldName',
      },
      body: {
        fieldName: [{id: 'baz', text: 'Baz Label'}],
      },
    });
  });

  it('supports autocomplete arguments from an integration', async function() {
    let wrapper = mount(<SelectAsyncField url="/foo/bar/" name="fieldName" />);

    wrapper.find('input[id="id-fieldName"]').simulate('change', {target: {value: 'baz'}});

    expect(api).toHaveBeenCalled();

    await tick();
    wrapper.update();

    // Is in select menu
    expect(wrapper.find('Select').prop('options')).toEqual([
      expect.objectContaining({
        value: 'baz',
        label: 'Baz Label',
      }),
    ]);
  });

  it('with Form context', async function() {
    let submitMock = jest.fn();
    let wrapper = mount(
      <Form onSubmit={submitMock}>
        <SelectAsyncField url="/foo/bar/" name="fieldName" />
      </Form>,
      {}
    );

    wrapper.find('input[id="id-fieldName"]').simulate('change', {target: {value: 'baz'}});

    await tick();
    wrapper.update();

    // Is in select menu
    expect(wrapper.find('Select').prop('options')).toEqual([
      expect.objectContaining({
        value: 'baz',
        label: 'Baz Label',
      }),
    ]);

    // Select item
    wrapper.find('input[id="id-fieldName"]').simulate('keyDown', {keyCode: 13});

    wrapper.find('Form').simulate('submit');
    expect(submitMock).toHaveBeenCalledWith(
      {
        fieldName: 'baz',
      },
      expect.anything(),
      expect.anything()
    );
  });
});
