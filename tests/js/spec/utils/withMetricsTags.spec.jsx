import {act, mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import MetricsTagStore from 'sentry/stores/metricsTagStore';
import withMetricTags from 'sentry/utils/withMetricTags';

describe('withMetricTags HoC', function () {
  beforeEach(() => {
    MetricsTagStore.reset();
  });

  afterEach(() => {});

  it('works', async function () {
    jest.spyOn(MetricsTagStore, 'trigger');
    const MyComponent = ({other, metricTags}) => {
      return (
        <div>
          <span>{other}</span>
          {metricTags &&
            Object.entries(metricTags).map(([key, tag]) => <em key={key}>{tag.key}</em>)}
        </div>
      );
    };

    const Container = withMetricTags(MyComponent);
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
