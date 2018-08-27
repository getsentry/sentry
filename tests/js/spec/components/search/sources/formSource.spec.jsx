import React from 'react';
import {mount} from 'enzyme';

import FormSource from 'app/components/search/sources/formSource';
import FormSearchActions from 'app/actions/formSearchActions';
import * as ActionCreators from 'app/actionCreators/formSearch';

describe('FormSource', function() {
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
  let loadStub;

  beforeEach(function() {
    loadStub = sinon.stub(ActionCreators, 'loadSearchMap');
    FormSearchActions.loadSearchMap(searchMap);
  });

  afterEach(function() {
    loadStub.restore();
  });

  it('can find a form field', async function() {
    let mock = jest.fn().mockReturnValue(null);
    wrapper = mount(<FormSource query="te">{mock}</FormSource>);

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
    wrapper = mount(<FormSource query="invalid">{mock}</FormSource>);

    await tick();
    wrapper.update();
    expect(mock).toHaveBeenCalledWith({
      isLoading: false,
      allResults: searchMap,
      results: [],
    });
  });
});
