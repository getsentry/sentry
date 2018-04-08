import React from 'react';
import {mount} from 'enzyme';

import FormFieldSearch from 'app/components/search/formFieldSearch';
import {addSearchMap} from 'app/actionCreators/formSearch';

describe('FormFieldSearch', function() {
  let wrapper;
  let searchMap = [
    {
      route: '/route/',
      field: {
        name: 'test-field',
        label: 'Test Field',
        help: 'test-help',
      },
    },
    {
      route: '/foo/',
      field: {
        name: 'foo-field',
        label: 'Foo Field',
        help: 'foo-help',
      },
    },
  ];

  beforeEach(function() {
    addSearchMap(searchMap);
  });

  it('can find a form field', async function() {
    let mock = jest.fn().mockReturnValue(null);
    wrapper = mount(<FormFieldSearch query="te">{mock}</FormFieldSearch>);

    await tick();
    await tick();
    wrapper.update();
    let calls = mock.mock.calls;
    expect(calls[calls.length - 1][0].results[0].item).toEqual({
      field: {
        label: 'Test Field',
        name: 'test-field',
        help: 'test-help',
      },
      route: '/route/',
      resultType: 'field',
      sourceType: 'field',
      to: '/route/#test-field',
    });
  });

  it('does not find any form field ', async function() {
    let mock = jest.fn().mockReturnValue(null);
    wrapper = mount(<FormFieldSearch query="invalid">{mock}</FormFieldSearch>);

    await tick();
    wrapper.update();
    expect(mock).toHaveBeenCalledWith({
      isLoading: false,
      allResults: searchMap,
      results: [],
    });
  });
});
