import React from 'react';
import {shallow} from 'enzyme';
import SnoozeAction from 'app/components/issues/snoozeAction';

describe('SnoozeAction', function() {
  beforeEach(function () {
    this.sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    this.sandbox.restore();
  });

  describe('render()', function() {
    it('should show a gravatar when avatar type is gravatar', function () {
      let wrapper = shallow(<SnoozeAction onSnooze={function(){}}/>);
      expect(wrapper.find('h5').text()).to.equal('How long should we ignore this issue?');
    });
  });

  describe('click handlers', function () {
    it('30m link should call prop w/ value 30', function (done) {
      let wrapper = shallow(<SnoozeAction onSnooze={function(duration){
        expect(duration).to.equal(30);
        done();
      }}/>);

      wrapper.find('ul').childAt(0).find('a').simulate('click');
    });

    it('forever link should call prop w/ value undefined', function (done) {
      let wrapper = shallow(<SnoozeAction onSnooze={function(duration){
        expect(duration).to.equal(undefined);
        done();
      }}/>);

      wrapper.find('ul').childAt(3).find('a').simulate('click');
    });
  });
});
