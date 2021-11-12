import {initializeOrg} from 'sentry-test/initializeOrg';
import {fireEvent, mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import MetricField from 'app/views/alerts/incidentRules/metricField';
import {Dataset} from 'app/views/alerts/incidentRules/types';
import Form from 'app/views/settings/components/forms/form';
import FormModel from 'app/views/settings/components/forms/model';

function openSelectMenu(text) {
  const keyDownEvent = {
    key: 'ArrowDown',
  };

  const placeholder = screen.getByText(text);
  fireEvent.keyDown(placeholder, keyDownEvent);
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
    mountWithTheme(
      <Form initialData={{dataset: Dataset.ERRORS}} model={model}>
        <MetricField name="metric" organization={organization} />
      </Form>
    );
  });

  it('has a select subset of error fields', function () {
    mountWithTheme(
      <Form initialData={{dataset: Dataset.ERRORS}} model={model}>
        <MetricField name="metric" organization={organization} />
      </Form>
    );
    openSelectMenu('(Required)');

    expect(screen.getByText('count()')).toBeInTheDocument();
    expect(screen.getByText('count_unique(…)')).toBeInTheDocument();

    // Select count_unique and verify the tags
    fireEvent.click(screen.getByText('count_unique(…)'));

    expect(model.fields.get('metric')).toBe('count_unique(tags[sentry:user])');
    expect(screen.getByText('tags[sentry:user]')).toBeInTheDocument();
  });

  it('has a select subset of transaction fields', function () {
    mountWithTheme(
      <Form initialData={{dataset: Dataset.TRANSACTIONS}} model={model}>
        <MetricField name="metric" organization={organization} />
      </Form>
    );
    openSelectMenu('(Required)');

    // 10 error aggregate configs
    expect(screen.getAllByTestId('label')).toHaveLength(10);
    fireEvent.click(screen.getByText('avg(…)'));
    expect(model.fields.get('metric')).toBe('avg(transaction.duration)');

    openSelectMenu('transaction.duration');
    expect(screen.getByText('measurements.lcp')).toBeInTheDocument();
    expect(screen.getByText('measurements.fcp')).toBeInTheDocument();
    expect(screen.getByText('measurements.ttfb.requesttime')).toBeInTheDocument();
  });

  it('maps field value to selected presets', function () {
    mountWithTheme(
      <Form initialData={{dataset: Dataset.TRANSACTIONS}} model={model}>
        <MetricField name="metric" organization={organization} />
      </Form>
    );
    openSelectMenu('(Required)');
    fireEvent.click(screen.getByText('failure_rate()'));

    expect(screen.getByLabelText('Failure rate')).toBeDisabled();

    openSelectMenu('failure_rate()');
    fireEvent.click(screen.getByText('p95(…)'));

    expect(screen.getByLabelText('Latency')).toBeDisabled();
  });

  it('changes field values when selecting presets', function () {
    mountWithTheme(
      <Form initialData={{dataset: Dataset.TRANSACTIONS}} model={model}>
        <MetricField name="metric" organization={organization} />
      </Form>
    );

    fireEvent.click(screen.getByText('Failure rate'));

    expect(screen.getByText('failure_rate()')).toBeInTheDocument();
  });
});
