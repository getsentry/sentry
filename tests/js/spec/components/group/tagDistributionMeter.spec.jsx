import React from 'react';
import ReactDOMServer from 'react-dom/server';

import TestUtils from 'react-dom/test-utils';

import {TagDistributionMeter} from 'app/components/group/tagDistributionMeter';

describe('TagDistributionMeter', function() {
  let sandbox;
  let element;
  let emptyElement;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();

    element = TestUtils.renderIntoDocument(
      <TagDistributionMeter
        key="element"
        tag="browser"
        group={{id: '1337'}}
        orgId="123"
        projectId="456"
        totalValues={TestStubs.Tags()[0].totalValues}
        topValues={TestStubs.TagValues()[0].topValues}
      />
    );

    emptyElement = TestUtils.renderIntoDocument(
      <TagDistributionMeter
        key="emptyElement"
        tag="browser"
        group={{id: '1337'}}
        orgId="123"
        projectId="456"
        totalValues={0}
      />
    );
  });

  afterEach(function() {
    sandbox.restore();
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
      emptyElement.setState(
        {
          error: false,
          loading: false,
        },
        () => {
          let out = emptyElement.renderBody();
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
