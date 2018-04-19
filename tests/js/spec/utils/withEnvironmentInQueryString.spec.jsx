import React from 'react';
import {shallow} from 'enzyme';
import {browserHistory} from 'react-router';

import withEnvironmentInQueryString from 'app/utils/withEnvironmentInQueryString';
import LatestContextStore from 'app/stores/latestContextStore';

class BasicComponent extends React.Component {
  render() {
    return <div>test component</div>;
  }
}

const WrappedComponent = withEnvironmentInQueryString(BasicComponent);

describe('withEnvironmentInQueryString', function() {
  beforeEach(function() {
    browserHistory.replace = jest.fn();
    LatestContextStore.onSetActiveOrganization({
      features: ['environments'],
    });
  });

  describe('updates environment', function() {
    let wrapper;
    beforeEach(function() {
      LatestContextStore.onSetActiveEnvironment({
        name: 'prod',
      });

      wrapper = shallow(
        <WrappedComponent location={{pathname: 'http://lol/', query: {}}} />,
        TestStubs.routerContext()
      );
    });

    it('passes environment prop to component', function() {
      expect(wrapper.prop('environment').name).toBe('prod');
    });

    it('replaces browser history', function() {
      expect(browserHistory.replace).toHaveBeenCalledWith('http://lol/?environment=prod');
    });
  });

  describe('handles correct environment value', function() {
    let wrapper;
    beforeEach(function() {
      LatestContextStore.onSetActiveEnvironment({
        name: 'prod',
      });

      wrapper = shallow(
        <WrappedComponent
          location={{pathname: 'http://lol', query: {environment: 'prod'}}}
        />,
        TestStubs.routerContext()
      );
    });

    it('passes environment prop to component', function() {
      expect(wrapper.prop('environment').name).toBe('prod');
    });

    it('does not replace browser history', function() {
      expect(browserHistory.replace).not.toHaveBeenCalled();
    });
  });

  describe('removes invalid environment value', function() {
    let wrapper;
    beforeEach(function() {
      LatestContextStore.onSetActiveEnvironment({name: 'staging'});

      wrapper = shallow(
        <WrappedComponent
          location={{pathname: 'http://lol/', query: {environment: 'prod'}}}
        />,
        TestStubs.routerContext()
      );
    });

    it('passes environment prop to component', function() {
      expect(wrapper.prop('environment').name).toBe('staging');
    });

    it('replaces browser history', function() {
      expect(browserHistory.replace).toHaveBeenCalledWith(
        'http://lol/?environment=staging'
      );
    });
  });
});
