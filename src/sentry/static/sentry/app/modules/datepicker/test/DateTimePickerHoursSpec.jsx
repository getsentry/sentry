
/** @jsx React.DOM */

/* global describe, beforeEach, afterEach, it, assert */
var DateTimePickerHours, React, ReactTestUtils;

React = require('react');

ReactTestUtils = require('react/lib/ReactTestUtils');

DateTimePickerHours = require('../cjs/DateTimePickerHours');

describe('DateTimePickerHours', function() {
  return it('Should have a timepicker-hours class', function() {
    var instance;
    instance = ReactTestUtils.renderIntoDocument(DateTimePickerHours());
    return assert.ok(instance.getDOMNode().className.match(/\btimepicker-hours\b/));
  });
});
