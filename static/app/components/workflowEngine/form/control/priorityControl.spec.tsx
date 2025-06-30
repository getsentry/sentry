import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import Form from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import PriorityControl from 'sentry/components/workflowEngine/form/control/priorityControl';
import {DetectorPriorityLevel} from 'sentry/types/workflowEngine/dataConditions';
import {
  DEFAULT_THRESHOLD_METRIC_FORM_DATA,
  METRIC_DETECTOR_FORM_FIELDS,
} from 'sentry/views/detectors/components/forms/metric/metricFormData';

describe('PriorityControl', function () {
  it('renders children', async function () {
    const formModel = new FormModel({
      initialData: {
        ...DEFAULT_THRESHOLD_METRIC_FORM_DATA,
        [METRIC_DETECTOR_FORM_FIELDS.initialPriorityLevel]: DetectorPriorityLevel.LOW,
      },
    });
    render(
      <Form model={formModel} hideFooter>
        <PriorityControl minimumPriority={DetectorPriorityLevel.LOW} />
      </Form>
    );

    expect(await screen.findByText('Above 0s')).toBeInTheDocument();
    expect(screen.getByLabelText('Medium threshold')).toBeInTheDocument();
    expect(screen.getByLabelText('High threshold')).toBeInTheDocument();
  });

  it('allows configuring priority', async function () {
    const formModel = new FormModel({
      initialData: {
        ...DEFAULT_THRESHOLD_METRIC_FORM_DATA,
        [METRIC_DETECTOR_FORM_FIELDS.initialPriorityLevel]: DetectorPriorityLevel.LOW,
      },
    });
    render(
      <Form model={formModel} hideFooter>
        <PriorityControl minimumPriority={DetectorPriorityLevel.LOW} />
      </Form>
    );
    expect(await screen.findByRole('button', {name: 'Low'})).toBeInTheDocument();
    expect(screen.getByText('Med')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Low'}));
    await userEvent.click(await screen.findByRole('option', {name: 'High'}));
    expect(formModel.getValue(METRIC_DETECTOR_FORM_FIELDS.initialPriorityLevel)).toBe(
      DetectorPriorityLevel.HIGH
    );
    // Check that the medium threshold is not visible
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('allows configuring medium and high thresholds', async function () {
    const formModel = new FormModel({
      initialData: {
        ...DEFAULT_THRESHOLD_METRIC_FORM_DATA,
        [METRIC_DETECTOR_FORM_FIELDS.initialPriorityLevel]: DetectorPriorityLevel.LOW,
      },
    });
    render(
      <Form model={formModel} hideFooter>
        <PriorityControl minimumPriority={DetectorPriorityLevel.LOW} />
      </Form>
    );
    const medium = screen.getByLabelText('Medium threshold');
    await userEvent.type(medium, '4');

    const high = screen.getByLabelText('High threshold');
    await userEvent.type(high, '5');

    expect(formModel.getValue(METRIC_DETECTOR_FORM_FIELDS.mediumThreshold)).toBe('4');
    expect(formModel.getValue(METRIC_DETECTOR_FORM_FIELDS.highThreshold)).toBe('5');
  });

  it('filters priority options based on minimumPriority prop', async function () {
    const formModel = new FormModel({
      initialData: {
        ...DEFAULT_THRESHOLD_METRIC_FORM_DATA,
        [METRIC_DETECTOR_FORM_FIELDS.initialPriorityLevel]: DetectorPriorityLevel.MEDIUM,
      },
    });

    render(
      <Form model={formModel} hideFooter>
        <PriorityControl minimumPriority={DetectorPriorityLevel.MEDIUM} />
      </Form>
    );

    // Open the priority dropdown
    await userEvent.click(screen.getByRole('button', {name: 'Med'}));

    // Should only show Medium and High options (not Low)
    expect(screen.getByRole('option', {name: 'Med'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'High'})).toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Low'})).not.toBeInTheDocument();
  });
});
