import {act, mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import MetricsTagStore from 'sentry/stores/metricsTagStore';
import withMetricsTags from 'sentry/utils/withMetricsTags';

describe('withMetricsTags HoC', function () {
  beforeEach(() => {
    MetricsTagStore.reset();
  });

  afterEach(() => {});

  it('works', async function () {
    jest.spyOn(MetricsTagStore, 'trigger');
    const MyComponent = ({other, metricsTags}) => {
      return (
        <div>
          <span>{other}</span>
          {metricsTags &&
            Object.entries(metricsTags).map(([key, tag]) => <em key={key}>{tag.key}</em>)}
        </div>
      );
    };

    const Container = withMetricsTags(MyComponent);
    mountWithTheme(<Container other="value" />);

    // Should forward props.
    expect(screen.getByText('value')).toBeInTheDocument();

    act(() => {
      MetricsTagStore.onLoadTagsSuccess([
        {key: 'environment'},
        {key: 'release'},
        {key: 'session.status'},
      ]);
    });

    // Should forward prop
    expect(screen.getByText('value')).toBeInTheDocument();

    expect(MetricsTagStore.trigger).toHaveBeenCalledTimes(1);

    // includes custom metricsTags
    const renderedTag = screen.getByText('session.status');
    expect(renderedTag).toBeInTheDocument();
  });
});
