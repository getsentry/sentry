import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import type {MetricMeta, UseCase} from 'sentry/types/metrics';

import {getMetricsWithDuplicateNames, MRISelect} from '.';

function createMetricMeta(
  name: string,
  unit: string,
  useCase: UseCase = 'custom'
): MetricMeta {
  return {
    mri: `d:${useCase}/${name}@${unit}`,
    blockingStatus: [],
    operations: [],
    projectIds: [],
    type: 'd',
    unit: unit,
  };
}

describe('getMetricsWithDuplicateNames', () => {
  it('should return a duplicate metric', () => {
    const metrics: MetricMeta[] = [
      createMetricMeta('metric1', 'none'),
      createMetricMeta('metric1', 'seconds'),
      createMetricMeta('metric2', 'milliseconds'),
    ];
    const result = getMetricsWithDuplicateNames(metrics);
    expect(result).toEqual(
      new Set(['d:custom/metric1@none', 'd:custom/metric1@seconds'])
    );
  });

  it('should multiple duplicate metrics', () => {
    const metrics: MetricMeta[] = [
      createMetricMeta('metric1', 'none'),
      createMetricMeta('metric1', 'seconds'),

      createMetricMeta('metric2', 'none'),
      createMetricMeta('metric2', 'milliseconds'),

      createMetricMeta('metric3', 'none'),
    ];
    const result = getMetricsWithDuplicateNames(metrics);
    expect(result).toEqual(
      new Set([
        'd:custom/metric1@none',
        'd:custom/metric1@seconds',
        'd:custom/metric2@none',
        'd:custom/metric2@milliseconds',
      ])
    );
  });

  it('should return an empty set if there are no duplicates', () => {
    const metrics: MetricMeta[] = [
      createMetricMeta('metric1', 'none'),
      createMetricMeta('metric2', 'seconds'),
      createMetricMeta('metric3', 'milliseconds'),
    ];
    const result = getMetricsWithDuplicateNames(metrics);
    expect(result).toEqual(new Set());
  });

  it('should return empty set for duplicates across use cases', () => {
    const metrics: MetricMeta[] = [
      createMetricMeta('metric1', 'none', 'custom'),
      createMetricMeta('metric1', 'seconds', 'metric_stats'),
      createMetricMeta('metric1', 'milliseconds', 'sessions'),
      createMetricMeta('metric1', 'bytes', 'spans'),
      createMetricMeta('metric1', 'bits', 'transactions'),
    ];
    const result = getMetricsWithDuplicateNames(metrics);
    expect(result).toEqual(new Set([]));
  });

  it('by clicking on the "create metric" button the metric modal shall be opened', async function () {
    const {project, organization} = initializeOrg({
      organization: {features: ['metrics-new-inputs']},
    });

    render(
      <MRISelect
        onChange={jest.fn()}
        onTagClick={jest.fn()}
        onOpenMenu={jest.fn()}
        isLoading={false}
        metricsMeta={[
          {
            blockingStatus: [],
            mri: 'c:custom/span.duration@none',
            operations: ['sum'],
            projectIds: [Number(project.id)],
            type: 'c',
            unit: 'none',
          },
        ]}
        projects={[Number(project)]}
        value="d:spans/duration@millisecond"
      />,
      {
        organization,
      }
    );

    renderGlobalModal();

    await userEvent.click(screen.getByLabelText('Metric'));
    await userEvent.click(screen.getByRole('button', {name: 'Create Metric'}));
    expect(screen.getByText(/Don’t see your span attribute/)).toBeInTheDocument();

    expect(
      await screen.findByRole('heading', {name: 'Create Metric'})
    ).toBeInTheDocument();
  });
});
