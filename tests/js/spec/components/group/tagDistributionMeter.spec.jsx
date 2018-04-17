import React from 'react';
import ReactDOMServer from 'react-dom/server';

import TestUtils from 'react-dom/test-utils';

import {Client} from 'app/api';
import {TagDistributionMeter} from 'app/components/group/tagDistributionMeter';

describe('TagDistributionMeter', function() {
  let sandbox;
  let stubbedApiRequest;
  let element;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();

    stubbedApiRequest = sandbox.stub(Client.prototype, 'request');

    element = TestUtils.renderIntoDocument(
      <TagDistributionMeter
        tag="browser"
        group={{id: '1337'}}
        orgId="123"
        projectId="456"
      />
    );
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('fetchData()', function() {
    it('should make a request to the groups/tags endpoint', function() {
      // NOTE: creation of OrganizationTeams causes a bunch of API requests to fire ...
      //       reset the request stub so that we can get an accurate count
      stubbedApiRequest.reset();

      element.fetchData();

      expect(stubbedApiRequest.callCount).toEqual(1);
      expect(stubbedApiRequest.getCall(0).args[0]).toEqual('/issues/1337/tags/browser/');
    });
  });

  describe('renderBody()', function() {
    it('should return null if loading', function(done) {
      element.setState(
        {
          loading: true,
          error: false,
        },
        () => {
          expect(element.renderBody()).toBe(null);
          done();
        }
      );
    });

    it('should return null if in an error state', function(done) {
      element.setState(
        {
          error: true,
          loading: false,
        },
        () => {
          expect(element.renderBody()).toBe(null);
          done();
        }
      );
    });

    it('should return "no recent data" if no total values present', function(done) {
      element.setState(
        {
          error: false,
          loading: false,
          data: {
            totalValues: 0,
          },
        },
        () => {
          let out = element.renderBody();
          expect(ReactDOMServer.renderToStaticMarkup(out)).toEqual(
            '<p>No recent data.</p>'
          );
          done();
        }
      );
    });

    it('should call renderSegments() if values present', function(done) {
      sandbox.stub(element, 'renderSegments');

      element.setState(
        {
          error: false,
          loading: false,
          data: {
            totalValues: 100,
          },
        },
        () => {
          element.renderBody();
          expect(element.renderSegments.callCount).toBeTruthy();
          done();
        }
      );
    });
  });
});
