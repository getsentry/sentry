import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import Form from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import PriorityControl from 'sentry/components/workflowEngine/form/control/priorityControl';
import {PriorityLevel} from 'sentry/types/group';
import {METRIC_DETECTOR_FORM_FIELDS} from 'sentry/views/detectors/components/forms/metricFormData';

describe('PriorityControl', function () {
  it('renders children', async function () {
    const formModel = new FormModel({
      initialData: {
        [METRIC_DETECTOR_FORM_FIELDS.initialPriorityLevel]: 'low',
        [METRIC_DETECTOR_FORM_FIELDS.conditionType]: 'gt',
        [METRIC_DETECTOR_FORM_FIELDS.conditionValue]: '0',
        [METRIC_DETECTOR_FORM_FIELDS.mediumThreshold]: '',
        [METRIC_DETECTOR_FORM_FIELDS.highThreshold]: '',
      },
    });
    render(
      <Form model={formModel} hideFooter>
        <PriorityControl />
      </Form>
    );

    expect(await screen.findByText('Above 0s')).toBeInTheDocument();
    expect(await screen.findByTestId('priority-control-medium')).toBeInTheDocument();
    expect(await screen.findByTestId('priority-control-high')).toBeInTheDocument();
  });

  it('allows configuring priority', async function () {
    const formModel = new FormModel({
      initialData: {
        [METRIC_DETECTOR_FORM_FIELDS.initialPriorityLevel]: 'low',
        [METRIC_DETECTOR_FORM_FIELDS.conditionType]: 'gt',
        [METRIC_DETECTOR_FORM_FIELDS.conditionValue]: '0',
        [METRIC_DETECTOR_FORM_FIELDS.mediumThreshold]: '',
        [METRIC_DETECTOR_FORM_FIELDS.highThreshold]: '',
      },
    });
    render(
      <Form model={formModel} hideFooter>
        <PriorityControl />
      </Form>
    );
    expect(await screen.findByRole('button', {name: 'Low'})).toBeInTheDocument();
    expect(screen.getByText('Med')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Low'}));
    await userEvent.click(await screen.findByRole('option', {name: 'High'}));
    expect(formModel.getValue(METRIC_DETECTOR_FORM_FIELDS.initialPriorityLevel)).toBe(
      PriorityLevel.HIGH
    );
    // Check that the medium threshold is not visible
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('allows configuring medium and high thresholds', async function () {
    const formModel = new FormModel({
      initialData: {
        [METRIC_DETECTOR_FORM_FIELDS.initialPriorityLevel]: 'low',
        [METRIC_DETECTOR_FORM_FIELDS.conditionType]: 'gt',
        [METRIC_DETECTOR_FORM_FIELDS.conditionValue]: '0',
        [METRIC_DETECTOR_FORM_FIELDS.mediumThreshold]: '',
        [METRIC_DETECTOR_FORM_FIELDS.highThreshold]: '',
      },
    });
    render(
      <Form model={formModel} hideFooter>
        <PriorityControl />
      </Form>
    );
    const medium = await screen.findByTestId('priority-control-medium');
    await userEvent.type(medium, '4');

    const high = await screen.findByTestId('priority-control-high');
    await userEvent.type(high, '5');

    expect(formModel.getValue(METRIC_DETECTOR_FORM_FIELDS.mediumThreshold)).toBe('4');
    expect(formModel.getValue(METRIC_DETECTOR_FORM_FIELDS.highThreshold)).toBe('5');
  });
});
