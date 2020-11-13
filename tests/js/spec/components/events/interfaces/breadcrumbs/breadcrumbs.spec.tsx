import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import BreadcrumbsInterface from 'app/components/events/interfaces/breadcrumbs';

describe('BreadcrumbsInterface', () => {
  let props;

  beforeEach(() => {
    props = {
      event: {
        entries: [],
        id: '4',
      },
      type: 'blah',
      data: {
        values: [
          {message: 'sup', category: 'default', level: 'extreme'},
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
          {message: 'sup', category: 'default', level: 'extreme'},
        ],
      },
    };
  });

  describe('filterCrumbs', () => {
    it('should filter crumbs based on crumb message', () => {
      const breadcrumbs = mountWithTheme(<BreadcrumbsInterface {...props} />);

      breadcrumbs.instance().handleSearch('hi');
      expect(breadcrumbs.state().searchTerm).toBe('hi');
      expect(breadcrumbs.state().filteredBySearch).toHaveLength(0);

      breadcrumbs.instance().handleSearch('up');
      expect(breadcrumbs.state().searchTerm).toBe('up');
      expect(breadcrumbs.state().filteredBySearch).toHaveLength(13);
    });

    it('should filter crumbs based on crumb level', () => {
      const breadcrumbs = mountWithTheme(<BreadcrumbsInterface {...props} />);

      breadcrumbs.instance().handleSearch('ext');
      expect(breadcrumbs.state().searchTerm).toBe('ext');
      expect(breadcrumbs.state().filteredBySearch).toHaveLength(16);
    });

    it('should filter crumbs based on crumb category', () => {
      const breadcrumbs = mountWithTheme(<BreadcrumbsInterface {...props} />);

      breadcrumbs.instance().handleSearch('error');
      expect(breadcrumbs.state().searchTerm).toBe('error');
      expect(breadcrumbs.state().filteredBySearch).toHaveLength(2);
    });
  });

  describe('render', () => {
    it('should display the correct number of crumbs with no filter', () => {
      props.data.values = props.data.values.slice(0, 4);
      const breadcrumbs = mountWithTheme(<BreadcrumbsInterface {...props} />);
      expect(breadcrumbs.find('Row')).toHaveLength(4);
    });

    it('should display the correct number of crumbs with a filter', () => {
      props.data.values = props.data.values.slice(0, 4);
      const breadcrumbs = mountWithTheme(<BreadcrumbsInterface {...props} />);

      breadcrumbs.instance().handleSearch('sup');
      expect(breadcrumbs.state().searchTerm).toBe('sup');
      breadcrumbs.update();
      expect(breadcrumbs.find('Row')).toHaveLength(1);
    });

    it('should not crash if data contains a toString attribute', () => {
      // Regression test: A "toString" property in data should not falsely be
      // used to coerce breadcrumb data to string. This would cause a TypeError.
      const data = {nested: {toString: 'hello'}};
      props.data.values = [{message: 'sup', category: 'default', level: 'info', data}];
      const breadcrumbs = mountWithTheme(<BreadcrumbsInterface {...props} />);
      expect(breadcrumbs.find('Row')).toHaveLength(1);
    });
  });
});
