import React from 'react';
import {shallow} from 'enzyme';
import ProjectLink from 'app/components/projectLink';

const path = 'http://some.url/';

describe('ProjectLink', function() {
  it('has environment in query', function() {
    const environments = ['staging', ''];

    environments.forEach(function(env) {
      const wrapper = shallow(<ProjectLink to={path}>Go somewhere!</ProjectLink>, {
        context: {
          location: {
            query: {
              environment: env,
            },
          },
        },
      });

      const updatedToProp = wrapper.find('Link').prop('to');

      expect(updatedToProp).toEqual({pathname: path, query: {environment: env}});

      expect(wrapper).toMatchSnapshot();
    });
  });

  it('does not have environment in query', function() {
    const wrapper = shallow(<ProjectLink to={path}>Go somewhere!</ProjectLink>, {
      context: {
        location: {
          query: {},
        },
      },
    });

    const updatedToProp = wrapper.find('Link').prop('to');

    expect(updatedToProp).toEqual(path);

    expect(wrapper).toMatchSnapshot();
  });
});
