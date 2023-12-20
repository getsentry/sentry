import {Event as EventFixture} from 'sentry-fixture/event';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import EventVitals from 'sentry/components/events/eventVitals';

describe('EventVitals', function () {
  it('should not render anything', function () {
    const event = EventFixture();
    const {container} = render(<EventVitals event={event} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should not render non web vitals', function () {
    const event = EventFixture({
      measurements: {
        'mark.stuff': {value: 123},
        'op.more.stuff': {value: 123},
      },
    });
    const {container} = render(<EventVitals event={event} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should render some web vitals with a header', function () {
    const event = EventFixture({
      measurements: {
        fp: {value: 1},
        fcp: {value: 2},
        lcp: {value: 3},
        fid: {value: 4},
        cls: {value: 0.1},
        ttfb: {value: 5},
        'ttfb.requesttime': {value: 6},
      },
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
    const event = EventFixture({
      measurements: {
        fp: {value: 1},
      },
      sdk: {version: '5.26.0'},
    });
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
    const event = EventFixture({
      measurements: {
        fp: {value: 5000},
        fcp: {value: 5000},
        lcp: {value: 5000},
        fid: {value: 4},
        cls: {value: 0.1},
        ttfb: {value: 5},
        'ttfb.requesttime': {value: 6},
      },
    });
    render(<EventVitals event={event} />);

    expect(screen.getAllByTestId('threshold-failed-warning')[0]).toBeInTheDocument();
  });
});
