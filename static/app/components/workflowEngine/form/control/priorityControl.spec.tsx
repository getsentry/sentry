import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import PriorityControl from 'sentry/components/workflowEngine/form/control/priorityControl';

describe('PriorityControl', function () {
  it('renders children', async function () {
    render(<PriorityControl name="priority" />);

    expect(await screen.findByText('Issue created')).toBeInTheDocument();
    expect(await screen.findByTestId('priority-control-medium')).toBeInTheDocument();
    expect(await screen.findByTestId('priority-control-high')).toBeInTheDocument();
  });

  it('allows configuring medium value', async function () {
    const mock = jest.fn();
    render(<PriorityControl onChange={mock} name="priority" />);
    const medium = await screen.findByTestId('priority-control-medium');
    await userEvent.type(medium, '12');
    expect(mock).toHaveBeenCalledWith({created: 'low', medium: '12', high: 0});
  });

  it('allows configuring high value', async function () {
    const mock = jest.fn();
    render(<PriorityControl onChange={mock} name="priority" />);
    const high = await screen.findByTestId('priority-control-high');
    await userEvent.type(high, '12');
    expect(mock).toHaveBeenCalledWith({created: 'low', high: '12', medium: 0});
  });

  it('allows configuring default value', async function () {
    const mock = jest.fn();
    render(<PriorityControl onChange={mock} name="priority" />);
    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(screen.getByRole('option', {name: 'High'}));
    expect(mock).toHaveBeenCalledWith({created: 'high', medium: 0, high: 0});
  });
});
