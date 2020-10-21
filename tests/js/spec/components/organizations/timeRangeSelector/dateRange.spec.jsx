import MockDate from 'mockdate';

import {mount} from 'sentry-test/enzyme';

import ConfigStore from 'app/stores/configStore';
import DateRange from 'app/components/organizations/timeRangeSelector/dateRange';

// 2017-10-14T02:38:00.000Z
// 2017-10-17T02:38:00.000Z
const start = new Date(1507948680000);
const end = new Date(1508207880000); //National Pasta Day

const getSelectedRange = wrapper => [
  wrapper.find('.rdrStartEdge').closest('DayCell').find('.rdrDayNumber span').text(),
  ...wrapper
    .find('.rdrInRange')
    .map(el => el.closest('DayCell').find('.rdrDayNumber span').text()),

  wrapper.find('.rdrEndEdge').closest('DayCell').find('.rdrDayNumber span').text(),
];

function getTimeText(element) {
  const valueRegex = /value="([0-9]{2}:[0-9]{2})"/;
  return element.html().match(valueRegex)[1];
}

describe('DateRange', function () {
  let wrapper;
  const onChange = jest.fn();
  const routerContext = TestStubs.routerContext();

  beforeAll(function () {
    MockDate.set(new Date('2017-10-16T23:41:20.000Z'));
    ConfigStore.loadInitialData({
      user: {options: {timezone: 'America/New_York'}},
    });
  });

  afterAll(function () {
    // reset mock date
    MockDate.set(new Date(1508208080000));
  });

  describe('Local time', function () {
    beforeEach(function () {
      onChange.mockReset();
    });
    beforeEach(function () {
      wrapper = mount(
        <DateRange
          start={start}
          end={end}
          showTimePicker
          onChange={onChange}
          onChangeUtc={jest.fn()}
          organization={TestStubs.Organization()}
        />,
        routerContext
      );
    });

    it('has the right max date', function () {
      expect(wrapper.find('StyledDateRangePicker').prop('maxDate')).toEqual(
        new Date('2017-10-16T23:41:20.000Z')
      );
    });

    it('has the right days selected', function () {
      // start/end inputs
      const startEndInputs = wrapper.find(
        '.rdrDateRangeWrapper .rdrDateDisplayItem input'
      );

      expect(startEndInputs.at(0).prop('value')).toBe('Oct 13, 2017');
      expect(startEndInputs.at(1).prop('value')).toBe('Oct 16, 2017');

      expect(getSelectedRange(wrapper)).toEqual(['13', '14', '15', '16']);
    });

    it('can select a date (midnight)', function () {
      wrapper.find('DayCell').at(0).simulate('mouseUp');

      //
      expect(onChange).toHaveBeenLastCalledWith({
        start: new Date('2017-10-01T04:00:00.000Z'),
        end: new Date('2017-10-02T03:59:59.000Z'),
      });
    });

    it('changes start time for existing date', function () {
      wrapper
        .find('input[data-test-id="startTime"]')
        .simulate('change', {target: {value: '11:00'}});

      expect(onChange).toHaveBeenLastCalledWith({
        start: new Date('2017-10-13T15:00:00.000Z'),
        end: new Date('2017-10-17T02:38:00.000Z'),
        hasDateRangeErrors: false,
      });
    });

    it('changes end time for existing date', function () {
      wrapper
        .find('input[data-test-id="endTime"]')
        .simulate('change', {target: {value: '12:00'}});

      expect(onChange).toHaveBeenLastCalledWith({
        start: new Date('2017-10-14T02:38:00.000Z'),
        end: new Date('2017-10-16T16:00:00.000Z'),
        hasDateRangeErrors: false,
      });
    });

    it('does not change for bad start/end time', function () {
      wrapper
        .find('input[data-test-id="startTime"]')
        .simulate('change', {target: {value: null}});

      expect(onChange).not.toHaveBeenLastCalledWith();

      wrapper
        .find('input[data-test-id="endTime"]')
        .simulate('change', {target: {value: null}});

      expect(onChange).not.toHaveBeenLastCalledWith();
    });

    it('updates start time input only if not focused', async function () {
      const time = start.getTime() + 60000;

      expect(getTimeText(wrapper.find('input[data-test-id="startTime"]'))).toEqual(
        '22:38'
      );

      wrapper.find('input[data-test-id="startTime"]').simulate('focus');
      await tick();
      wrapper.update();

      wrapper.setProps({start: new Date(time)});
      await tick();
      wrapper.update();

      // because the prop change happened while the component still has focus, no update
      expect(getTimeText(wrapper.find('input[data-test-id="startTime"]'))).toEqual(
        '22:38'
      );

      wrapper.find('input[data-test-id="startTime"]').simulate('blur');
      await tick();
      wrapper.update();

      wrapper.setProps({start: new Date(time)});
      await tick();
      wrapper.update();

      // because the prop change happened after the component lost focus, it updates
      expect(getTimeText(wrapper.find('input[data-test-id="startTime"]'))).toEqual(
        '22:39'
      );
    });

    it('updates end time input only if not focused', async function () {
      const time = end.getTime() + 60000;

      expect(getTimeText(wrapper.find('input[data-test-id="endTime"]'))).toEqual('22:38');

      wrapper.find('input[data-test-id="endTime"]').simulate('focus');
      await tick();
      wrapper.update();

      wrapper.setProps({end: new Date(time)});
      await tick();
      wrapper.update();

      // because the prop change happened while the component still has focus, no update
      expect(getTimeText(wrapper.find('input[data-test-id="endTime"]'))).toEqual('22:38');

      wrapper.find('input[data-test-id="endTime"]').simulate('blur');
      await tick();
      wrapper.update();

      wrapper.setProps({end: new Date(time)});
      await tick();
      wrapper.update();

      // because the prop change happened after the component lost focus, it updates
      expect(getTimeText(wrapper.find('input[data-test-id="endTime"]'))).toEqual('22:39');
    });
  });

  describe('UTC', function () {
    beforeEach(function () {
      onChange.mockReset();
      wrapper = mount(
        <DateRange
          start={start}
          end={end}
          showTimePicker
          utc
          onChange={onChange}
          onChangeUtc={jest.fn()}
          organization={TestStubs.Organization()}
        />,
        routerContext
      );
    });

    it('has the right max date', function () {
      expect(wrapper.find('StyledDateRangePicker').prop('maxDate')).toEqual(
        new Date('2017-10-16T23:41:20.000Z')
      );
    });

    it('has the right days selected', function () {
      // start/end inputs
      const startEndInputs = wrapper.find(
        '.rdrDateRangeWrapper .rdrDateDisplayItem input'
      );

      expect(startEndInputs.at(0).prop('value')).toBe('Oct 13, 2017');
      expect(startEndInputs.at(1).prop('value')).toBe('Oct 16, 2017');

      expect(getSelectedRange(wrapper)).toEqual(['13', '14', '15', '16']);
    });

    it('can select a date (midnight)', function () {
      wrapper.find('DayCell').at(0).simulate('mouseUp');

      //
      expect(onChange).toHaveBeenLastCalledWith({
        start: new Date('2017-10-01T04:00:00.000Z'),
        end: new Date('2017-10-02T03:59:59.000Z'),
      });
    });

    it('changes utc start time for existing date', function () {
      wrapper
        .find('input[data-test-id="startTime"]')
        .simulate('change', {target: {value: '11:00'}});

      // Initial start date  is 2017-10-13T22:38:00-0400
      expect(onChange).toHaveBeenLastCalledWith({
        start: new Date('2017-10-13T15:00:00.000Z'),
        end: new Date('2017-10-17T02:38:00.000Z'),
        hasDateRangeErrors: false,
      });
    });

    it('changes utc end time for existing date', function () {
      wrapper
        .find('input[data-test-id="endTime"]')
        .simulate('change', {target: {value: '12:00'}});

      // Initial end time is 2017-10-16T22:38:00-0400
      // Setting this to 12:00 means 2017-10-16T12:00-0400
      expect(onChange).toHaveBeenLastCalledWith({
        start: new Date('2017-10-14T02:38:00.000Z'),
        end: new Date('2017-10-16T16:00:00.000Z'),
        hasDateRangeErrors: false,
      });
    });

    it('does not change for bad start/end time', function () {
      wrapper
        .find('input[data-test-id="startTime"]')
        .simulate('change', {target: {value: null}});

      expect(onChange).not.toHaveBeenLastCalledWith();

      wrapper
        .find('input[data-test-id="endTime"]')
        .simulate('change', {target: {value: null}});

      expect(onChange).not.toHaveBeenLastCalledWith();
    });

    it('updates utc start time input only if not focused', async function () {
      // NOTE: the DateRange component initializes the time inputs with the local time
      const time = start.getTime() + 60000;

      expect(getTimeText(wrapper.find('input[data-test-id="startTime"]'))).toEqual(
        '22:38'
      );

      wrapper.find('input[data-test-id="startTime"]').simulate('focus');
      await tick();
      wrapper.update();

      wrapper.setProps({start: new Date(time)});
      await tick();
      wrapper.update();

      // because the prop change happened while the component still has focus, no update
      expect(getTimeText(wrapper.find('input[data-test-id="startTime"]'))).toEqual(
        '22:38'
      );

      wrapper.find('input[data-test-id="startTime"]').simulate('blur');
      await tick();
      wrapper.update();

      wrapper.setProps({start: new Date(time)});
      await tick();
      wrapper.update();

      // because the prop change happened after the component lost focus, it updates
      expect(getTimeText(wrapper.find('input[data-test-id="startTime"]'))).toEqual(
        '22:39'
      );
    });

    it('updates utc end time input only if not focused', async function () {
      // NOTE: the DateRange component initializes the time inputs with the local time
      const time = end.getTime() + 60000;

      expect(getTimeText(wrapper.find('input[data-test-id="endTime"]'))).toEqual('22:38');

      wrapper.find('input[data-test-id="endTime"]').simulate('focus');
      await tick();
      wrapper.update();

      wrapper.setProps({end: new Date(time)});
      await tick();
      wrapper.update();

      // because the prop change happened while the component still has focus, no update
      expect(getTimeText(wrapper.find('input[data-test-id="endTime"]'))).toEqual('22:38');

      wrapper.find('input[data-test-id="endTime"]').simulate('blur');
      await tick();
      wrapper.update();

      wrapper.setProps({end: new Date(time)});
      await tick();
      wrapper.update();

      // because the prop change happened after the component lost focus, it updates
      expect(getTimeText(wrapper.find('input[data-test-id="endTime"]'))).toEqual('22:39');
    });
  });
});
