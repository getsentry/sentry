import React from 'react';
import {shallow} from 'enzyme';

import {Client} from 'app/api';
import ActionLink from 'app/views/stream/actionLink';

describe('ActionLink', function() {

  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();

    this.stubbedApiRequest = this.sandbox.stub(Client.prototype, 'request');
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  describe('shouldConfirm()', function() {
    it('should always return true by default', function () {
      let actionLink = shallow(
        <ActionLink onAction={function(){}} selectAllActive={false}/>
      ).instance();

      expect(actionLink.shouldConfirm(0)).to.be.true;
      expect(actionLink.shouldConfirm(1)).to.be.true;
      expect(actionLink.shouldConfirm(25)).to.be.true;
    });

    it('should return (mostly) true when props.onlyIfBulk is true and all are selected', function () {
      let actionLink = shallow(
        <ActionLink onlyIfBulk={true} selectAllActive={true} onAction={function(){}}/>
      ).instance();

      expect(actionLink.shouldConfirm(1)).to.be.false; // EDGE CASE: if just 1, shouldn't confirm even if "all" selected
      expect(actionLink.shouldConfirm(2)).to.be.true;
      expect(actionLink.shouldConfirm(25)).to.be.true;
    });

    it('should return false when props.onlyIfBulk is true and not all are selected', function () {
      let actionLink = shallow(
        <ActionLink onlyIfBulk={true} selectAllActive={false} onAction={function(){}}/>
      ).instance();

      expect(actionLink.shouldConfirm(1)).to.be.false;
      expect(actionLink.shouldConfirm(2)).to.be.false;
      expect(actionLink.shouldConfirm(25)).to.be.false;
    });
  });
});

