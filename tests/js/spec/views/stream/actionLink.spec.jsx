import React from 'react';
import TestUtils from 'react-addons-test-utils';

import api from 'app/api';
import stubReactComponents from '../../../helpers/stubReactComponent';
import ActionLink from 'app/views/stream/actionLink';
import Modal from 'react-bootstrap/lib/Modal';

describe('ActionLink', function() {

  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();

    this.stubbedApiRequest = this.sandbox.stub(api, 'request');
    stubReactComponents(this.sandbox, [Modal]);
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  describe('shouldConfirm()', function() {
    it('should always return true by default', function () {
      let actionLink = TestUtils.renderIntoDocument(
        <ActionLink onAction={function(){}} selectAllActive={false}/>
      );

      expect(actionLink.shouldConfirm(0)).to.be.true;
      expect(actionLink.shouldConfirm(1)).to.be.true;
      expect(actionLink.shouldConfirm(25)).to.be.true;
    });

    it('should return false when props.neverConfirm is true', function () {
      let actionLink = TestUtils.renderIntoDocument(
        <ActionLink neverConfirm={true} onAction={function(){}} selectAllActive={false}/>
      );

      expect(actionLink.shouldConfirm(0)).to.be.false;
      expect(actionLink.shouldConfirm(1)).to.be.false;
      expect(actionLink.shouldConfirm(25)).to.be.false;
    });


    it('should return (mostly) true when props.onlyIfBulk is true and all are selected', function () {
      let actionLink = TestUtils.renderIntoDocument(
        <ActionLink onlyIfBulk={true} selectAllActive={true} onAction={function(){}}/>
      );

      expect(actionLink.shouldConfirm(1)).to.be.false; // EDGE CASE: if just 1, shouldn't confirm even if "all" selected
      expect(actionLink.shouldConfirm(2)).to.be.true;
      expect(actionLink.shouldConfirm(25)).to.be.true;
    });

    it('should return false when props.onlyIfBulk is true and not all are selected', function () {
      let actionLink = TestUtils.renderIntoDocument(
        <ActionLink onlyIfBulk={true} selectAllActive={false} onAction={function(){}}/>
      );

      expect(actionLink.shouldConfirm(1)).to.be.false;
      expect(actionLink.shouldConfirm(2)).to.be.false;
      expect(actionLink.shouldConfirm(25)).to.be.false;
    });
  });
});

