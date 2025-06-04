import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import PriorityControl from 'sentry/components/workflowEngine/form/control/priorityControl';
import {PriorityLevel} from 'sentry/types/group';

describe('PriorityControl', function () {
  it('renders children', async function () {
    render(<PriorityControl name="priority" />);

    expect(await screen.findByText('Issue created')).toBeInTheDocument();
    expect(await screen.findByTestId('priority-control-medium')).toBeInTheDocument();
    expect(await screen.findByTestId('priority-control-high')).toBeInTheDocument();
  });
  it('allows configuring priority', async function () {
    const mock = jest.fn();
    render(<PriorityControl onPriorityChange={mock} name="priority" />);
    await userEvent.click(await screen.findByRole('button'));
    await userEvent.click(await screen.findByRole('option', {name: 'High'}));
    expect(mock).toHaveBeenCalledWith(PriorityLevel.HIGH);
  });
  it('allows configuring medium threshold', async function () {
    const mock = jest.fn();
    render(<PriorityControl onThresholdChange={mock} name="priority" />);
    const medium = await screen.findByTestId('priority-control-medium');
    await userEvent.type(medium, '12');
    expect(mock).toHaveBeenCalledWith(PriorityLevel.MEDIUM, 12);
  });

  it('allows configuring high value', async function () {
    const mock = jest.fn();
    render(<PriorityControl onThresholdChange={mock} name="priority" />);
    const high = await screen.findByTestId('priority-control-high');
    await userEvent.type(high, '12');
    expect(mock).toHaveBeenCalledWith(PriorityLevel.HIGH, 12);
  });
});
