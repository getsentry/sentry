import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {MetricsSummary} from 'sentry/components/events/interfaces/spans/types';
import {CustomMetricsEventData} from 'sentry/views/metrics/customMetricsEventData';

describe('CustomMetricsEventData', () => {
  it('renders empty (no feature flag)', () => {
    const metricsSummary: MetricsSummary = {
      'd:custom/my.metric@second': [
        {
          count: 2,
          min: 1,
          max: 2,
          sum: 3,
          tags: {
            foo: 'bar',
          },
        },
      ],
    };
    const {container} = render(
      <CustomMetricsEventData
        metricsSummary={metricsSummary}
        startTimestamp={1706189398.176}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders empty (no data)', () => {
    const organization = OrganizationFixture({features: ['ddm-ui']});
    const {container} = render(
      <CustomMetricsEventData metricsSummary={{}} startTimestamp={1706189398.176} />,
      {
        organization,
      }
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders (all information)', () => {
    const organization = OrganizationFixture({features: ['ddm-ui']});
    const metricsSummary: MetricsSummary = {
      'd:custom/my.metric@second': [
        {
          count: 2,
          min: 1,
          max: 2,
          sum: 3,
          tags: {
            foo: 'bar',
          },
        },
      ],
    };

    render(
      <CustomMetricsEventData
        metricsSummary={metricsSummary}
        startTimestamp={1706189398.176}
      />,
      {
        organization,
      }
    );

    expect(screen.getByText('Emitted Metrics')).toBeInTheDocument();

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('my.metric')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Open in Metrics'})).toBeInTheDocument();

    expect(screen.getByText('Stats')).toBeInTheDocument();
    expect(screen.getByText(/Type: distribution/)).toBeInTheDocument();
    expect(screen.getByText(/Count: 2/)).toBeInTheDocument();
    expect(screen.getByText(/Min: 1s/)).toBeInTheDocument();
    expect(screen.getByText(/Max: 2s/)).toBeInTheDocument();
    expect(screen.getByText(/Sum: 3s/)).toBeInTheDocument();
    expect(screen.getByText(/Avg: 1\.5s/)).toBeInTheDocument();

    expect(screen.getByText('Tags')).toBeInTheDocument();
    expect(screen.getByText('foo')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'bar'})).toBeInTheDocument();
  });

  it('renders (count === 1)', () => {
    const organization = OrganizationFixture({features: ['ddm-ui']});
    const metricsSummary: MetricsSummary = {
      'd:custom/my.metric@second': [
        {
          count: 1,
          min: 2,
          max: 2,
          sum: 2,
          tags: {
            foo: 'bar',
          },
        },
      ],
    };

    render(
      <CustomMetricsEventData
        metricsSummary={metricsSummary}
        startTimestamp={1706189398.176}
      />,
      {
        organization,
      }
    );

    expect(screen.getByText('Emitted Metrics')).toBeInTheDocument();

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('my.metric')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Open in Metrics'})).toBeInTheDocument();

    expect(screen.getByText('Stats')).toBeInTheDocument();
    expect(screen.getByText(/Type: distribution/)).toBeInTheDocument();
    expect(screen.getByText(/Value: 2s/)).toBeInTheDocument();

    expect(screen.getByText('Tags')).toBeInTheDocument();
    expect(screen.getByText('foo')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'bar'})).toBeInTheDocument();
  });

  it('renders (counter metric)', () => {
    const organization = OrganizationFixture({features: ['ddm-ui']});
    const metricsSummary: MetricsSummary = {
      'c:custom/my.metric@second': [
        {
          count: 1,
          min: 1,
          max: 1,
          sum: 1,
          tags: {
            foo: 'bar',
          },
        },
      ],
    };

    render(
      <CustomMetricsEventData
        metricsSummary={metricsSummary}
        startTimestamp={1706189398.176}
      />,
      {
        organization,
      }
    );

    expect(screen.getByText('Emitted Metrics')).toBeInTheDocument();

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('my.metric')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Open in Metrics'})).toBeInTheDocument();

    expect(screen.getByText('Stats')).toBeInTheDocument();
    expect(screen.getByText(/Type: counter/)).toBeInTheDocument();
    expect(screen.getByText(/Count: 1/)).toBeInTheDocument();

    expect(screen.getByText('Tags')).toBeInTheDocument();
    expect(screen.getByText('foo')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'bar'})).toBeInTheDocument();
  });

  it('renders (no tags)', () => {
    const organization = OrganizationFixture({features: ['ddm-ui']});
    const metricsSummary: MetricsSummary = {
      'c:custom/my.metric@second': [
        {
          count: 1,
          min: 1,
          max: 1,
          sum: 1,
          tags: null,
        },
      ],
    };

    render(
      <CustomMetricsEventData
        metricsSummary={metricsSummary}
        startTimestamp={1706189398.176}
      />,
      {
        organization,
      }
    );

    expect(screen.getByText('Emitted Metrics')).toBeInTheDocument();

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('my.metric')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Open in Metrics'})).toBeInTheDocument();

    expect(screen.getByText('Stats')).toBeInTheDocument();
    expect(screen.getByText(/Type: counter/)).toBeInTheDocument();
    expect(screen.getByText(/Count: 1/)).toBeInTheDocument();

    expect(screen.queryByText('Tags')).not.toBeInTheDocument();
  });

  it('renders (empty tags)', () => {
    const organization = OrganizationFixture({features: ['ddm-ui']});
    const metricsSummary: MetricsSummary = {
      'c:custom/my.metric@second': [
        {
          count: 1,
          min: 1,
          max: 1,
          sum: 1,
          tags: {},
        },
      ],
    };

    render(
      <CustomMetricsEventData
        metricsSummary={metricsSummary}
        startTimestamp={1706189398.176}
      />,
      {
        organization,
      }
    );

    expect(screen.getByText('Emitted Metrics')).toBeInTheDocument();

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('my.metric')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Open in Metrics'})).toBeInTheDocument();

    expect(screen.getByText('Stats')).toBeInTheDocument();
    expect(screen.getByText(/Type: counter/)).toBeInTheDocument();
    expect(screen.getByText(/Count: 1/)).toBeInTheDocument();

    expect(screen.queryByText('Tags')).not.toBeInTheDocument();
  });

  it('renders (multiple)', () => {
    const organization = OrganizationFixture({features: ['ddm-ui']});
    const metricsSummary: MetricsSummary = {
      'd:custom/my.distribution@second': [
        {
          count: 2,
          min: 1,
          max: 2,
          sum: 3,
          tags: {
            foo: 'bar',
          },
        },
        {
          count: 1,
          min: 1,
          max: 1,
          sum: 1,
          tags: null,
        },
      ],
      'c:custom/my.counter@second': [
        {
          count: 2,
          min: 1,
          max: 2,
          sum: 3,
          tags: {
            foo: 'bar',
          },
        },
      ],
    };

    render(
      <CustomMetricsEventData
        metricsSummary={metricsSummary}
        startTimestamp={1706189398.176}
      />,
      {
        organization,
      }
    );

    expect(screen.getByText('Emitted Metrics')).toBeInTheDocument();

    expect(screen.getAllByText('Name')).toHaveLength(3);
    expect(screen.getAllByText('my.distribution')).toHaveLength(2);
    expect(screen.getAllByText('my.counter')).toHaveLength(1);
  });
});
