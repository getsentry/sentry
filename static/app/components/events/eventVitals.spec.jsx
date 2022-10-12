import {render, screen} from 'sentry-test/reactTestingLibrary';

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
    const {container} = render(<EventVitals event={event} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should not render non web vitals', function () {
    const event = makeEvent({
      'mark.stuff': 123,
      'op.more.stuff': 123,
    });
    const {container} = render(<EventVitals event={event} />);
    expect(container).toBeEmptyDOMElement();
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
    render(<EventVitals event={event} />);

    expect(screen.getByText('Web Vitals')).toBeInTheDocument();

    [
      'Cumulative Layout Shift',
      'First Contentful Paint',
      'First Input Delay',
      'First Paint',
      'Largest Contentful Paint',
      'Time to First Byte',
      'Request Time',
    ].forEach(vital => expect(screen.getByText(vital)).toBeInTheDocument());
  });

  it('should render some web vitals with a heading and a sdk warning', function () {
    const event = makeEvent({fp: 1}, {version: '5.26.0'});
    render(<EventVitals event={event} />);

    [
      'Cumulative Layout Shift',
      'First Contentful Paint',
      'First Input Delay',
      'Largest Contentful Paint',
      'Time to First Byte',
      'Request Time',
    ].forEach(vital => expect(screen.queryByText(vital)).not.toBeInTheDocument());

    expect(screen.getByTestId('outdated-sdk-warning')).toBeInTheDocument();
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
    render(<EventVitals event={event} />);

    expect(screen.getAllByTestId('threshold-failed-warning')[0]).toBeInTheDocument();
  });
});
