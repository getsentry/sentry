import React from 'react';
import {shallow} from 'enzyme';
import GlobalSelectionLink from 'app/components/globalSelectionLink';

const path = 'http://some.url/';

describe('GlobalSelectionLink', function() {
  it('has global selection values in query', function() {
    const query = {
      project: ['foo', 'bar'],
      environment: 'staging',
    };

    const wrapper = shallow(
      <GlobalSelectionLink to={path}>Go somewhere!</GlobalSelectionLink>,
      {
        context: {
          location: {
            query,
          },
        },
      }
    );

    const updatedToProp = wrapper.find('Link').prop('to');

    expect(updatedToProp).toEqual({pathname: path, query});

    expect(wrapper).toMatchSnapshot();
  });

  it('does not have global selection values in query', function() {
    const wrapper = shallow(
      <GlobalSelectionLink to={path}>Go somewhere!</GlobalSelectionLink>,
      {
        context: {
          location: {
            query: {},
          },
        },
      }
    );

    const updatedToProp = wrapper.find('Link').prop('to');

    expect(updatedToProp).toEqual(path);

    expect(wrapper).toMatchSnapshot();
  });

  it('combines query paramaters with custom query', function() {
    const query = {
      project: ['foo', 'bar'],
      environment: 'staging',
    };
    const custom_query = {query: '"something"'};
    const wrapper = shallow(
      <GlobalSelectionLink to={{pathname: path, query: custom_query}}>
        Go somewhere!
      </GlobalSelectionLink>,
      {
        context: {
          location: {
            query,
          },
        },
      }
    );

    const updatedToProp = wrapper.find('Link').prop('to');

    expect(updatedToProp).toEqual({
      pathname: path,
      query: Object.assign(query, custom_query),
    });

    expect(wrapper).toMatchSnapshot();
  });

  it('combines query paramaters with no query', function() {
    const query = {
      project: ['foo', 'bar'],
      environment: 'staging',
    };
    const wrapper = shallow(
      <GlobalSelectionLink to={{pathname: path}}>Go somewhere!</GlobalSelectionLink>,
      {
        context: {
          location: {
            query,
          },
        },
      }
    );

    const updatedToProp = wrapper.find('Link').prop('to');

    expect(updatedToProp).toEqual({pathname: path, query});

    expect(wrapper).toMatchSnapshot();
  });
});
