import {mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import MetricsMetaStore from 'sentry/stores/metricsMetaStore';
import withMetricsMeta, {InjectedMetricsMetaProps} from 'sentry/utils/withMetricsMeta';

interface MyComponentProps extends InjectedMetricsMetaProps {
  other: string;
}

describe('withMetricsMeta HoC', function () {
  beforeEach(() => {
    MetricsMetaStore.reset();
  });

  it('works', function () {
    jest.spyOn(MetricsMetaStore, 'trigger');
    const MyComponent = (props: MyComponentProps) => {
      return (
        <div>
          <span>{props.other}</span>
          {props.metricsMeta &&
            Object.entries(props.metricsMeta).map(([key, meta]) => (
              <em key={key}>{meta.name}</em>
            ))}
        </div>
      );
    };

    const Container = withMetricsMeta(MyComponent);
    mountWithTheme(<Container other="value" />);

    // Should forward props.
    expect(screen.getByText('value')).toBeInTheDocument();

    MetricsMetaStore.onLoadSuccess([
      {
        name: 'sentry.sessions.session',
        type: 'counter',
        operations: ['sum'],
      },
      {
        name: 'sentry.sessions.session.error',
        type: 'set',
        operations: ['count_unique'],
      },
    ]);

    // Should forward prop
    expect(screen.getByText('value')).toBeInTheDocument();

    expect(MetricsMetaStore.trigger).toHaveBeenCalledTimes(1);

    expect(screen.getByText('sentry.sessions.session')).toBeInTheDocument();
    expect(screen.getByText('sentry.sessions.session.error')).toBeInTheDocument();
  });
});
