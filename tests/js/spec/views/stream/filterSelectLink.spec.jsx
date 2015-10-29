import React from "react";
import ReactDOM from "react-dom";
import TestUtils from "react-addons-test-utils";
import FilterSelectLink from "app/views/stream/filterSelectLink";

let findWithClass = TestUtils.findRenderedDOMComponentWithClass;

describe("FilterSelectLink", function() {

  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  describe("render()", function() {

    it("shows a button", function(){
      let wrapper = TestUtils.renderIntoDocument(<FilterSelectLink extraClass="test-btn" />);
      let expected = findWithClass(wrapper, "test-btn");
      expect(expected).to.be.ok;
    });

    it("shows active state when passed isActive=true", function(){
      let wrapper = TestUtils.renderIntoDocument(<FilterSelectLink isActive={true} />);
      let expected = findWithClass(wrapper, "active");
      expect(expected).to.be.ok;
    });

    it("doesn't show active state when passed isActive=false", function(){
      let wrapper = TestUtils.renderIntoDocument(<FilterSelectLink isActive={false} />);
      expect(() => findWithClass(wrapper, "active")).to.throw();
    });

    it("calls onSelect() when anchor clicked", function(){
      let onSelect = this.sandbox.spy();
      let wrapper = TestUtils.renderIntoDocument(<FilterSelectLink onSelect={onSelect} />);

      TestUtils.Simulate.click(ReactDOM.findDOMNode(wrapper));

      expect(onSelect.called).to.be.true;
    });

  });

});

