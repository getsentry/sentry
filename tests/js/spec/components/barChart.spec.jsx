import React from 'react';
import ReactDOM from 'react-dom';
import TestUtils from 'react-addons-test-utils';

import BarChart from 'app/components/barChart';

describe('BarChart', function() {

  describe('render()', function() {

    it('renders with default props', function() {
      let comp = TestUtils.renderIntoDocument(<BarChart />);
      expect(comp).to.be.ok;
    });

    it('renders with points data', function () {
      let points = [
        {x: 1439766000, y: 10},
        {x: 1439769600, y: 20},
        {x: 1439773200, y: 30},
      ];

      let comp = TestUtils.renderIntoDocument(<BarChart points={points}/>);
      let columns = ReactDOM.findDOMNode(comp).querySelectorAll('.chart-column');

      expect(columns).to.have.property('length', 3);
      expect(columns[0]).to.have.property('textContent', '10'); // check y values
      expect(columns[1]).to.have.property('textContent', '20');
      expect(columns[2]).to.have.property('textContent', '30');
    });

    it('renders with points and markers', function () {
      let points = [
        {x: 1439769600, y: 10},
        {x: 1439773200, y: 20},
        {x: 1439776800, y: 30}
      ];
      let markers = [
        {x: 1439769600, className: 'first-seen', label: 'first seen'}, // matches first point
        {x: 1439776800, className: 'last-seen', label: 'last seen'} // matches last point
      ];

      let comp = TestUtils.renderIntoDocument(<BarChart points={points} markers={markers}/>);
      let columns = ReactDOM.findDOMNode(comp).getElementsByTagName('a');

      expect(columns).to.have.property('length', 5);

      // NOTE: markers are placed *before* corresponding chart column
      expect(columns[0]).to.have.property('textContent', 'first seen');
      expect(columns[1]).to.have.property('textContent', '10');
      expect(columns[2]).to.have.property('textContent', '20');
      expect(columns[3]).to.have.property('textContent', 'last seen');
      expect(columns[4]).to.have.property('textContent', '30');
    });

    it('renders with points and markers, when first and last seen are same data point', function () {
      let points = [
        {x: 1439776800, y: 30}
      ];
      let markers = [
        {x: 1439776800, className: 'first-seen', label: 'first seen'},
        {x: 1439776800, className: 'last-seen', label: 'last seen'}
      ];

      let comp = TestUtils.renderIntoDocument(<BarChart points={points} markers={markers}/>);
      let columns = ReactDOM.findDOMNode(comp).getElementsByTagName('a');

      expect(columns).to.have.property('length', 3);

      // NOTE: markers are placed *before* corresponding chart column
      expect(columns[0]).to.have.property('textContent', 'first seen');
      expect(columns[1]).to.have.property('textContent', 'last seen');
      expect(columns[2]).to.have.property('textContent', '30');
    });
  });

});

