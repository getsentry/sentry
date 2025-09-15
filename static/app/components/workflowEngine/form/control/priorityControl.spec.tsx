import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import Form from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import PriorityControl from 'sentry/components/workflowEngine/form/control/priorityControl';
import {DetectorPriorityLevel} from 'sentry/types/workflowEngine/dataConditions';
import {
  DEFAULT_THRESHOLD_METRIC_FORM_DATA,
  METRIC_DETECTOR_FORM_FIELDS,
} from 'sentry/views/detectors/components/forms/metric/metricFormData';

describe('PriorityControl', () => {
  it('renders children', async () => {
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

    expect(await screen.findByText('Above 0ms')).toBeInTheDocument();
    expect(screen.getByLabelText('High threshold')).toBeInTheDocument();
  });

  it('allows configuring priority', async () => {
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
    expect(await screen.findByRole('button', {name: 'Med'})).toBeInTheDocument();
    expect(screen.getByText('Med')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Med'}));
    await userEvent.click(await screen.findByRole('option', {name: 'High'}));
    expect(formModel.getValue(METRIC_DETECTOR_FORM_FIELDS.initialPriorityLevel)).toBe(
      DetectorPriorityLevel.HIGH
    );
    // Check that the medium threshold is not visible
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('allows configuring high thresholds', async () => {
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

    const high = screen.getByLabelText('High threshold');
    await userEvent.type(high, '5');

    expect(formModel.getValue(METRIC_DETECTOR_FORM_FIELDS.highThreshold)).toBe('5');
  });

  it('filters priority options based on minimumPriority prop', async () => {
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

  it('validates that medium threshold is lower than high threshold', async () => {
    const formModel = new FormModel({
      initialData: {
        ...DEFAULT_THRESHOLD_METRIC_FORM_DATA,
        [METRIC_DETECTOR_FORM_FIELDS.initialPriorityLevel]: DetectorPriorityLevel.MEDIUM,
        [METRIC_DETECTOR_FORM_FIELDS.conditionValue]: '10', // This is the medium threshold
      },
    });

    render(
      <Form model={formModel} hideFooter>
        <PriorityControl minimumPriority={DetectorPriorityLevel.MEDIUM} />
      </Form>
    );

    // Only high threshold field should be visible when initial priority is MEDIUM
    const highField = screen.getByLabelText('High threshold');
    expect(screen.queryByLabelText('Medium threshold')).not.toBeInTheDocument();

    // Test invalid case: high (5) <= medium (10)
    await userEvent.clear(highField);
    await userEvent.type(highField, '5');

    expect(formModel.getError(METRIC_DETECTOR_FORM_FIELDS.highThreshold)).toBe(
      'High threshold must be higher than medium threshold'
    );

    // Test valid case: high (15) > medium (10)
    await userEvent.clear(highField);
    await userEvent.type(highField, '15');

    // Validation should clear error when high > medium
    expect(formModel.getError(METRIC_DETECTOR_FORM_FIELDS.highThreshold)).toBeFalsy();
  });
});
