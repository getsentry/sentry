import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import BreadcrumbsInterface from 'app/components/events/interfaces/breadcrumbsV2';

describe('BreadcrumbsInterface', function() {
  let PROPS;

  beforeEach(() => {
    PROPS = {
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

  describe('filterCrumbs', function() {
    it('should filter crumbs based on crumb message', function() {
      const breadcrumbs = mountWithTheme(<BreadcrumbsInterface {...PROPS} />);
      const breadcrumbSearhInput = breadcrumbs.find('[id="id-breadcumber-search"]');

      breadcrumbSearhInput.simulate('change', {target: {value: 'hi'}});
      expect(breadcrumbs.state().searchTerm).toBe('hi');
      expect(breadcrumbs.state().filteredBreadcrumbs).toHaveLength(0);

      breadcrumbSearhInput.simulate('change', {target: {value: 'up'}});
      expect(breadcrumbs.state().searchTerm).toBe('up');
      expect(breadcrumbs.state().filteredBreadcrumbs).toHaveLength(13);
    });

    it('should filter crumbs based on crumb level', function() {
      const breadcrumbs = mountWithTheme(<BreadcrumbsInterface {...PROPS} />);
      const breadcrumbSearhInput = breadcrumbs.find('[id="id-breadcumber-search"]');

      breadcrumbSearhInput.simulate('change', {target: {value: 'ext'}});
      expect(breadcrumbs.state().searchTerm).toBe('ext');
      expect(breadcrumbs.state().filteredBreadcrumbs).toHaveLength(16);
    });

    it('should filter crumbs based on crumb category', function() {
      const breadcrumbs = mountWithTheme(<BreadcrumbsInterface {...PROPS} />);
      const breadcrumbSearhInput = breadcrumbs.find('[id="id-breadcumber-search"]');

      breadcrumbSearhInput.simulate('change', {target: {value: 'error'}});
      expect(breadcrumbs.state().searchTerm).toBe('error');
      expect(breadcrumbs.state().filteredBreadcrumbs).toHaveLength(2);
    });
  });

  describe('render', function() {
    it('should display the correct number of crumbs with no filter', function() {
      const breadcrumbs = mountWithTheme(<BreadcrumbsInterface {...PROPS} />);
      expect(breadcrumbs.find('[data-test-id="breadcrumb"]').hostNodes()).toHaveLength(
        10
      );
    });

    it('should display the correct number of crumbs with a filter', function() {
      const breadcrumbs = mountWithTheme(<BreadcrumbsInterface {...PROPS} />);
      const breadcrumbSearhInput = breadcrumbs.find('[id="id-breadcumber-search"]');

      breadcrumbSearhInput.simulate('change', {target: {value: 'sup'}});
      expect(breadcrumbs.state().searchTerm).toBe('sup');
      expect(breadcrumbs.find('[data-test-id="breadcrumb"]').hostNodes()).toHaveLength(
        10
      );

      const collapsedBreadcrumb = breadcrumbs
        .find('[data-test-id="breadcrumb-collapsed"]')
        .hostNodes();
      collapsedBreadcrumb.simulate('click');
      expect(breadcrumbs.state().filteredBreadcrumbs).toHaveLength(13);
    });

    it('should not crash if data contains a toString attribute', () => {
      // Regression test: A "toString" property in data should not falsely be
      // used to coerce breadcrumb data to string. This would cause a TypeError.
      const data = {nested: {toString: 'hello'}};
      PROPS.data.values = [{message: 'sup', category: 'default', level: 'info', data}];
      const breadcrumbs = mountWithTheme(<BreadcrumbsInterface {...PROPS} />);
      expect(breadcrumbs.find('[data-test-id="breadcrumb"]').hostNodes()).toHaveLength(1);
    });
  });
});
