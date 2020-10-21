import {shallow} from 'sentry-test/enzyme';

import SnoozeAction from 'app/components/issues/snoozeAction';

describe('SnoozeAction', function () {
  beforeEach(function () {});

  afterEach(function () {});

  describe('render()', function () {
    it('should show a gravatar when avatar type is gravatar', function () {
      const wrapper = shallow(<SnoozeAction onSnooze={function () {}} />);
      expect(wrapper.find('h5').text()).toEqual('How long should we ignore this issue?');
    });
  });

  describe('click handlers', function () {
    it('30m link should call prop w/ value 30', function (done) {
      const wrapper = shallow(
        <SnoozeAction
          onSnooze={function (duration) {
            expect(duration).toEqual(30);
            done();
          }}
        />
      );

      wrapper.find('ul').childAt(0).find('a').simulate('click');
    });

    it('forever link should call prop w/ value undefined', function (done) {
      const wrapper = shallow(
        <SnoozeAction
          onSnooze={function (duration) {
            expect(duration).toEqual(undefined);
            done();
          }}
        />
      );

      wrapper.find('ul').childAt(3).find('a').simulate('click');
    });
  });
});
