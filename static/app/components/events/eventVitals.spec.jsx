import {mountWithTheme} from 'sentry-test/enzyme';

import EventVitals from 'sentry/components/events/eventVitals';

function makeEvent(measurements = {}, sdk = {version: '5.27.3'}) {
  const formattedMeasurements = {};
  for (const [name, value] of Object.entries(measurements)) {
    formattedMeasurements[name] = {value};
  }
  const event = {measurements: formattedMeasurements};
  if (sdk !== null) {
    event.sdk = sdk;
  }
  return event;
}

describe('EventVitals', function () {
  it('should not render anything', function () {
    const event = makeEvent({});
    const wrapper = mountWithTheme(<EventVitals event={event} />);
    expect(wrapper.isEmptyRender()).toBe(true);
  });

  it('should not render non web vitals', function () {
    const event = makeEvent({
      'mark.stuff': 123,
      'op.more.stuff': 123,
    });
    const wrapper = mountWithTheme(<EventVitals event={event} />);
    expect(wrapper.isEmptyRender()).toBe(true);
  });

  it('should render some web vitals with a header', function () {
    const event = makeEvent({
      fp: 1,
      fcp: 2,
      lcp: 3,
      fid: 4,
      cls: 0.1,
      ttfb: 5,
      'ttfb.requesttime': 6,
    });
    const wrapper = mountWithTheme(<EventVitals event={event} />);
    expect(wrapper.find('SectionHeading').text()).toEqual('Web Vitals');
    expect(wrapper.find('WarningIconContainer').exists()).toBe(false);
    expect(wrapper.find('EventVital')).toHaveLength(7);
  });

  it('should render some web vitals with a heading and a sdk warning', function () {
    const event = makeEvent({fp: 1}, {version: '5.26.0'});
    const wrapper = mountWithTheme(<EventVitals event={event} />);
    expect(wrapper.find('SectionHeading').text()).toEqual('Web Vitals');
    expect(wrapper.find('WarningIconContainer').exists()).toBe(true);
    expect(wrapper.find('EventVital')).toHaveLength(1);
  });

  it('should show fire icon if vital failed threshold', function () {
    const event = makeEvent({
      fp: 5000,
      fcp: 5000,
      lcp: 5000,
      fid: 4,
      cls: 0.1,
      ttfb: 5,
      'ttfb.requesttime': 6,
    });
    const wrapper = mountWithTheme(<EventVitals event={event} />);
    expect(wrapper.find('SectionHeading').text()).toEqual('Web Vitals');
    expect(wrapper.find('EventVital')).toHaveLength(7);
    expect(wrapper.find('IconFire')).toHaveLength(3);
  });
});
