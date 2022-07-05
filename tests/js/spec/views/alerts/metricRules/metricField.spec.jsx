import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import Form from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import MetricField from 'sentry/views/alerts/rules/metric/metricField';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';

function openSelectMenu(text) {
  const placeholder = screen.getByText(text);
  userEvent.type(placeholder, '{keyDown}');
}

describe('MetricField', function () {
  let model;
  const {organization} = initializeOrg({
    organization: {features: ['performance-view']},
  });

  beforeEach(function () {
    model = new FormModel();
  });

  it('renders', function () {
    render(
      <Form initialData={{dataset: Dataset.ERRORS}} model={model}>
        <MetricField name="metric" organization={organization} />
      </Form>
    );
  });

  it('has a select subset of error fields', function () {
    render(
      <Form initialData={{dataset: Dataset.ERRORS}} model={model}>
        <MetricField name="metric" organization={organization} />
      </Form>
    );
    openSelectMenu('(Required)');

    expect(screen.getByText('count()')).toBeInTheDocument();
    expect(screen.getByText('count_unique(…)')).toBeInTheDocument();

    // Select count_unique and verify the tags
    userEvent.click(screen.getByText('count_unique(…)'));

    expect(model.fields.get('metric')).toBe('count_unique(tags[sentry:user])');
    expect(screen.getByText('tags[sentry:user]')).toBeInTheDocument();
  });

  it('has a select subset of transaction fields', function () {
    render(
      <Form initialData={{dataset: Dataset.TRANSACTIONS}} model={model}>
        <MetricField name="metric" organization={organization} />
      </Form>
    );
    openSelectMenu('(Required)');

    // 10 error aggregate configs
    [
      'avg(…)',
      'percentile(…)',
      'p50(…)',
      'p75(…)',
      'p95(…)',
      'p99(…)',
      'p100(…)',
      'failure_rate()',
      'apdex(…)',
      'count()',
    ].forEach(label => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
    userEvent.click(screen.getByText('avg(…)'));
    expect(model.fields.get('metric')).toBe('avg(transaction.duration)');

    openSelectMenu('transaction.duration');
    expect(screen.getByText('measurements.lcp')).toBeInTheDocument();
    expect(screen.getByText('measurements.fcp')).toBeInTheDocument();
    expect(screen.getByText('measurements.ttfb.requesttime')).toBeInTheDocument();
  });
});
