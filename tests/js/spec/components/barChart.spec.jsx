import React from "react/addons";
import BarChart from "app/components/barChart";
var TestUtils = React.addons.TestUtils;

describe("BarChart", function() {

  describe("render()", function() {

    it("renders with default props", function() {
      var comp = TestUtils.renderIntoDocument(<BarChart />, document.body);
      expect(comp).to.be.ok;
    });

    it("renders with points data", function () {
      var points = [
        { x: 1439766000, y: 10 },
        { x: 1439769600, y: 20 },
        { x: 1439773200, y: 30 },
      ];

      var comp = TestUtils.renderIntoDocument(<BarChart interval={3600} points={points}/>);
      var columns = comp.getDOMNode().querySelectorAll('.chart-column');

      expect(columns).to.have.property('length', 3);
      expect(columns[0]).to.have.property('textContent', '10'); // check y values
      expect(columns[1]).to.have.property('textContent', '20');
      expect(columns[2]).to.have.property('textContent', '30');
    });

    it("renders with points and markers", function () {
      var points = [
        { x: 1439769600, y: 10 },
        { x: 1439773200, y: 20 },
        { x: 1439776800, y: 30 }
      ];
      var markers = [
        { x: 1439769600, className: 'first-seen', label: 'first seen' }, // matches first point
        { x: 1439776800, className: 'last-seen', label: 'last seen' } // matches last point
      ];

      var comp = TestUtils.renderIntoDocument(<BarChart interval={3600} points={points} markers={markers}/>, document.body);
      var columns = comp.getDOMNode().getElementsByTagName('a');

      expect(columns).to.have.property('length', 5);

      // NOTE: markers are placed *before* corresponding chart column
      expect(columns[0]).to.have.property('textContent', 'first seen');
      expect(columns[1]).to.have.property('textContent', '10');
      expect(columns[2]).to.have.property('textContent', '20');
      expect(columns[3]).to.have.property('textContent', 'last seen');
      expect(columns[4]).to.have.property('textContent', '30');
    });

    it("renders with points and markers, when first and last seen are same data point", function () {
      var points = [
        { x: 1439776800, y: 30 }
      ];
      var markers = [
        { x: 1439776800, className: 'first-seen', label: 'first seen' },
        { x: 1439776800, className: 'last-seen', label: 'last seen' }
      ];

      var comp = TestUtils.renderIntoDocument(<BarChart interval={3600} points={points} markers={markers}/>, document.body);
      var columns = comp.getDOMNode().getElementsByTagName('a');

      expect(columns).to.have.property('length', 3);

      // NOTE: markers are placed *before* corresponding chart column
      expect(columns[0]).to.have.property('textContent', 'first seen');
      expect(columns[1]).to.have.property('textContent', 'last seen');
      expect(columns[2]).to.have.property('textContent', '30');
    });
  });

});

