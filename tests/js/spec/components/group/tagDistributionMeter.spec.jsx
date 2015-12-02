import React from 'react';
import ReactDOMServer from 'react-dom/server';

import TestUtils from 'react-addons-test-utils';

import {Client} from 'app/api';
import TagDistributionMeter from 'app/components/group/tagDistributionMeter';

describe('TagDistributionMeter', function() {

  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();

    this.stubbedApiRequest = this.sandbox.stub(Client.prototype, 'request');

    this.element = TestUtils.renderIntoDocument(
      <TagDistributionMeter tag="browser" group={{id:'1337'}} orgId="123" projectId="456"/>
    );
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  describe('fetchData()', function() {
    it('should make a request to the groups/tags endpoint', function () {
      // NOTE: creation of OrganizationTeams causes a bunch of API requests to fire ...
      //       reset the request stub so that we can get an accurate count
      this.stubbedApiRequest.reset();

      this.element.fetchData();

      expect(this.stubbedApiRequest.callCount).to.equal(1);
      expect(this.stubbedApiRequest.getCall(0).args[0]).to.equal('/issues/1337/tags/browser/');
    });
  });

  describe('renderBody()', function () {
    it('should return null if loading', function (done) {
      this.element.setState({
        loading: true,
        error: false
      }, () => {
        expect(this.element.renderBody()).to.be.null;
        done();
      });
    });

    it('should return null if in an error state', function (done) {
      this.element.setState({
        error: true,
        loading: false
      }, () => {
        expect(this.element.renderBody()).to.be.null;
        done();
      });
    });

    it('should return "no recent data" if no total values present', function (done) {
      this.element.setState({
        error: false,
        loading: false,
        data: {
          totalValues: 0
        }
      }, () => {
        let out = this.element.renderBody();
        expect(ReactDOMServer.renderToStaticMarkup(out)).to.eql('<p>No recent data.</p>');
        done();
      });
    });

    it('should call renderSegments() if values present', function (done) {
      this.sandbox.stub(this.element, 'renderSegments');

      this.element.setState({
        error: false,
        loading: false,
        data: {
          totalValues: 100
        }
      }, () => {
        this.element.renderBody();
        expect(this.element.renderSegments.calledOnce);
        done();
      });
    });
  });
});

