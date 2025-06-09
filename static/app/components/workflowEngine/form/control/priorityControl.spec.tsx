import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import Form from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import PriorityControl from 'sentry/components/workflowEngine/form/control/priorityControl';
import {PriorityLevel} from 'sentry/types/group';

describe('PriorityControl', function () {
  it('renders children', async function () {
    const formModel = new FormModel({
      initialData: {
        'conditionGroup.conditions.0.type': 'above',
        'conditionGroup.conditions.0.comparison': '0',
        'conditionGroup.conditions.0.conditionResult': PriorityLevel.LOW,
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
        'conditionGroup.conditions.0.type': 'above',
        'conditionGroup.conditions.0.comparison': '0',
        'conditionGroup.conditions.0.conditionResult': PriorityLevel.LOW,
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
    expect(formModel.getValue('conditionGroup.conditions.0.conditionResult')).toBe(
      PriorityLevel.HIGH
    );
    // Check that the medium threshold is not visible
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('allows configuring medium threshold', async function () {
    const formModel = new FormModel({
      initialData: {
        'conditionGroup.conditions.0.type': 'above',
        'conditionGroup.conditions.0.comparison': '0',
        'conditionGroup.conditions.0.conditionResult': PriorityLevel.LOW,
      },
    });
    render(
      <Form model={formModel} hideFooter>
        <PriorityControl />
      </Form>
    );
    const medium = await screen.findByTestId('priority-control-medium');
    await userEvent.type(medium, '12');
    expect(formModel.getValue('conditionGroup.conditions.1.comparison')).toBe('12');
  });

  it('allows configuring high value', async function () {
    const formModel = new FormModel({
      initialData: {
        'conditionGroup.conditions.0.type': 'above',
        'conditionGroup.conditions.0.comparison': '0',
        'conditionGroup.conditions.0.conditionResult': PriorityLevel.LOW,
      },
    });
    render(
      <Form model={formModel} hideFooter>
        <PriorityControl />
      </Form>
    );
    const high = await screen.findByTestId('priority-control-high');
    await userEvent.type(high, '12');
    expect(formModel.getValue('conditionGroup.conditions.2.comparison')).toBe('12');
  });
});
