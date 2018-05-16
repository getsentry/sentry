import React from 'react';
import {shallow} from 'enzyme';

import StackedBarChart from 'app/components/stackedBarChart';

describe('StackedBarChart', function() {
  describe('render()', function() {
    it('renders with points data', function() {
      let points = [
        {x: 1439766000, y: [10]},
        {x: 1439769600, y: [20]},
        {x: 1439773200, y: [30]},
      ];

      let wrapper = shallow(<StackedBarChart points={points} />);
      let columns = wrapper.find('Column');

      expect(columns).toHaveProperty('length', 3);
      expect(
        columns
          .at(0)
          .childAt(0)
          .props().children
      ).toEqual(10); // check y values
      expect(
        columns
          .at(1)
          .childAt(0)
          .props().children
      ).toEqual(20);
      expect(
        columns
          .at(2)
          .childAt(0)
          .props().children
      ).toEqual(30);
    });

    it('renders with points and markers', function() {
      let points = [
        {x: 1439769600, y: [10]},
        {x: 1439773200, y: [20]},
        {x: 1439776800, y: [30]},
      ];
      let markers = [
        {x: 1439769600, className: 'first-seen', label: 'first seen'}, // matches first point
        {x: 1439776800, className: 'last-seen', label: 'last seen'}, // matches last point
      ];

      let wrapper = shallow(<StackedBarChart points={points} markers={markers} />);
      let columns = wrapper.find('Column');
      let columnMarkers = wrapper.find('Marker');

      expect(columns).toHaveProperty('length', 3);
      expect(columnMarkers).toHaveProperty('length', 2);

      expect(columnMarkers.at(0).props().children).toEqual('first seen');
      expect(columnMarkers.at(1).props().children).toEqual('last seen');

      expect(
        columns
          .at(0)
          .childAt(0)
          .props().children
      ).toEqual(10);
      expect(
        columns
          .at(1)
          .childAt(0)
          .props().children
      ).toEqual(20);
      expect(
        columns
          .at(2)
          .childAt(0)
          .props().children
      ).toEqual(30);
    });

    it('renders with points and markers, when first and last seen are same data point', function() {
      let points = [{x: 1439776800, y: [30]}];
      let markers = [
        {x: 1439776800, className: 'first-seen', label: 'first seen'},
        {x: 1439776800, className: 'last-seen', label: 'last seen'},
      ];

      let wrapper = shallow(<StackedBarChart points={points} markers={markers} />);
      let columns = wrapper.find('Column');
      let columnMarkers = wrapper.find('Marker');

      expect(columns).toHaveProperty('length', 1);
      expect(columnMarkers).toHaveProperty('length', 2);

      expect(columnMarkers.at(0).props().children).toEqual('first seen');
      expect(columnMarkers.at(1).props().children).toEqual('last seen');
      expect(
        columns
          .at(0)
          .childAt(0)
          .props().children
      ).toEqual(30);
    });
  });
});
