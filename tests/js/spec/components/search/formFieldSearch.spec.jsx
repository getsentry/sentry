import React from 'react';
import {mount} from 'enzyme';

import FormFieldSearch from 'app/components/search/formFieldSearch';
import {addSearchMap} from 'app/actionCreators/formSearch';

// jest.useFakeTimers();

// const CLOSE_DELAY = 0;

describe('FormFieldSearch', function() {
  let wrapper;
  let searchMap = {
    test: {
      route: '/route/',
      field: {
        name: 'test-field',
      },
    },
    foo: {
      route: '/foo/',
      field: {
        name: 'foo-field',
      },
    },
  };

  beforeEach(function() {
    addSearchMap(searchMap);
  });

  it('can find a form field', function(done) {
    let mock = jest.fn().mockReturnValue(null);
    wrapper = mount(<FormFieldSearch query="te">{mock}</FormFieldSearch>);

    setTimeout(() => {
      wrapper.update();
      expect(mock).toHaveBeenCalledWith({
        isLoading: false,
        allResults: searchMap,
        results: [
          {
            field: {name: 'test-field'},
            resultType: 'field',
            route: '/route/',
            sourceType: 'field',
            to: '/route/#test-field',
          },
        ],
      });
      done();
    });
  });

  it('does not find any form field ', function(done) {
    let mock = jest.fn().mockReturnValue(null);
    wrapper = mount(<FormFieldSearch query="invalid">{mock}</FormFieldSearch>);

    setTimeout(() => {
      wrapper.update();
      expect(mock).toHaveBeenCalledWith({
        isLoading: false,
        allResults: searchMap,
        results: [],
      });
      done();
    });
  });
});
