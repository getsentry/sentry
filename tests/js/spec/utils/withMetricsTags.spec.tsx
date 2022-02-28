import {mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import MetricsTagStore from 'sentry/stores/metricsTagStore';
import withMetricsTags, {InjectedMetricsTagsProps} from 'sentry/utils/withMetricsTags';

interface MyComponentProps extends InjectedMetricsTagsProps {
  other: string;
}

describe('withMetricsTags HoC', function () {
  beforeEach(() => {
    MetricsTagStore.reset();
  });

  it('works', function () {
    jest.spyOn(MetricsTagStore, 'trigger');
    const MyComponent = (props: MyComponentProps) => {
      return (
        <div>
          <span>{props.other}</span>
          {props.metricsTags &&
            Object.entries(props.metricsTags).map(([key, tag]) => (
              <em key={key}>{tag.key}</em>
            ))}
        </div>
      );
    };

    const Container = withMetricsTags(MyComponent);
    mountWithTheme(<Container other="value" />);

    // Should forward props.
    expect(screen.getByText('value')).toBeInTheDocument();

    MetricsTagStore.onLoadTagsSuccess([
      {key: 'environment'},
      {key: 'release'},
      {key: 'session.status'},
    ]);

    // Should forward prop
    expect(screen.getByText('value')).toBeInTheDocument();

    expect(MetricsTagStore.trigger).toHaveBeenCalledTimes(1);

    // includes custom metricsTags
    const renderedTag = screen.getByText('session.status');
    expect(renderedTag).toBeInTheDocument();
  });
});
