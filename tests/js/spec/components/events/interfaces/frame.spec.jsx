import React from "react";
import TestUtils from "react-addons-test-utils";
import stubReactComponents from "../../../../helpers/stubReactComponent";

import Frame from "app/components/events/interfaces/frame";
import FrameVariables from "app/components/events/interfaces/frameVariables";

describe("Frame", function () {
  beforeEach(function () {
    this.sandbox = sinon.sandbox.create();
    stubReactComponents(this.sandbox, [FrameVariables]);
  });

  afterEach(function () {
    this.sandbox.restore();
  });

  describe("renderOriginalSourceInfo()", function () {
    beforeEach(function () {
      this.data = {
        origAbsPath: 'https://beta.getsentry.com/_static/sentry/dist/vendor.js',
        origColNo: 2503,
        origFilename: '/_static/sentry/dist/vendor.js',
        origFunction: 'T._updateRenderedComponent',
        origLineNo: 419,
        map: 'vendor.js.map',
        mapUrl: 'https://beta.getsentry.com/_static/sentry/dist/vendor.js.map'
      };
    });

    it("should render the original source information as a HTML string", function () {
      let frame = TestUtils.renderIntoDocument(<Frame data={this.data} />);

      // NOTE: indentation/whitespace intentional to match output string
      expect(frame.renderOriginalSourceInfo()).to.eql(`
    <div>
      <strong>Original Filename</strong><br/>
      <a href="https://beta.getsentry.com/_static/sentry/dist/vendor.js">https://beta.getsentry.com/_static/sentry/dist/vendor.js</a><br/>
      <strong>Line Number</strong><br/>
      419<br/>
      <strong>Column Number</strong><br/>
      2503<br/>
      <strong>Function</strong><br/>
      T._updateRenderedComponent<br/>
      <strong>Source Map</strong><br/><a href="https://beta.getsentry.com/_static/sentry/dist/vendor.js.map">vendor.js.map<br/></div>`);
    });

    it("should omit a source map <a> tag if no mapUrl is provided", function () {
      delete this.data.mapUrl;

      let frame = TestUtils.renderIntoDocument(<Frame data={this.data} />);
      expect(frame.renderOriginalSourceInfo()).to.eql(`
    <div>
      <strong>Original Filename</strong><br/>
      <a href="https://beta.getsentry.com/_static/sentry/dist/vendor.js">https://beta.getsentry.com/_static/sentry/dist/vendor.js</a><br/>
      <strong>Line Number</strong><br/>
      419<br/>
      <strong>Column Number</strong><br/>
      2503<br/>
      <strong>Function</strong><br/>
      T._updateRenderedComponent<br/>
      <strong>Source Map</strong><br/>vendor.js.map<br/></div>`);
    });
  });
});

