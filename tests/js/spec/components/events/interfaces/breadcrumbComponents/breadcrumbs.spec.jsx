import React from 'react';
import {shallow} from 'enzyme';
import BreadcrumbsInterface from 'app/components/events/interfaces/breadcrumbs';
import Breadcrumb from 'app/components/events/interfaces/breadcrumbs/breadcrumb';

describe('BreadcrumbsInterface', function() {
  const PROPS = {
    group: {
      id: '1'
    },
    event: {
      entries: [],
      id: '4'
    },
    type: 'blah',
    data: {
      values: [{message: 'sup', category: 'default', level: 'extreme'},
               {message: 'hey', category: 'error', level: 'info'},
               {message: 'hello', category: 'default', level: 'extreme'},
               {message: 'bye', category: 'default', level: 'extreme'},
               {message: 'ok', category: 'error', level: 'extreme'},
               {message: 'sup', category: 'default', level: 'extreme'},
               {message: 'sup', category: 'default', level: 'extreme'},
               {message: 'sup', category: 'default', level: 'extreme'},
               {message: 'sup', category: 'default', level: 'extreme'},
               {message: 'sup', category: 'default', level: 'extreme'},
               {message: 'sup', category: 'default', level: 'extreme'},
               {message: 'sup', category: 'default', level: 'extreme'},
               {message: 'sup', category: 'default', level: 'extreme'},
               {message: 'sup', category: 'default', level: 'extreme'},
               {message: 'sup', category: 'default', level: 'extreme'},
               {message: 'sup', category: 'default', level: 'extreme'},
               {message: 'sup', category: 'default', level: 'extreme'}]
    }
  };
  describe('filterCrumbs', function() {
    it('should filter crumbs based on crumb message', function() {
      const breadcrumbs = shallow(<BreadcrumbsInterface {...PROPS}/>).instance();
      expect(breadcrumbs.filterCrumbs(PROPS.data.values, 'hi')).to.have.length(0);
      expect(breadcrumbs.filterCrumbs(PROPS.data.values, 'up')).to.have.length(13);
    });

    it('should filter crumbs based on crumb level', function() {
      const breadcrumbs = shallow(<BreadcrumbsInterface {...PROPS}/>).instance();
      expect(breadcrumbs.filterCrumbs(PROPS.data.values, 'hi')).to.have.length(0);
      expect(breadcrumbs.filterCrumbs(PROPS.data.values, 'ext')).to.have.length(16);
    });

    it('should filter crumbs based on crumb category', function() {
      const breadcrumbs = shallow(<BreadcrumbsInterface {...PROPS}/>).instance();
      expect(breadcrumbs.filterCrumbs(PROPS.data.values, 'hi')).to.have.length(0);
      expect(breadcrumbs.filterCrumbs(PROPS.data.values, 'error')).to.have.length(2);
    });

  });


  describe('render', function() {
    it('should display the correct number of crumbs with no filter', function() {
      const wrapper = shallow(<BreadcrumbsInterface {...PROPS}/>);
      expect(wrapper.find(Breadcrumb)).to.have.length(10);
    });

    it('should display the correct number of crumbs with a filter', function() {
      const wrapper = shallow(<BreadcrumbsInterface {...PROPS}/>);
      wrapper.setState({queryValue: 'sup'});
      expect(wrapper.find(Breadcrumb)).to.have.length(10);
      wrapper.setState({queryValue: 'sup', collapsed: false});
      expect(wrapper.find(Breadcrumb)).to.have.length(13);
    });
  });
});
