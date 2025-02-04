import {render, screen} from 'sentry-test/reactTestingLibrary';

import PriorityControl from 'sentry/components/workflowEngine/form/control/priorityControl';

describe('PriorityControl', function () {
  it('renders children', async function () {
    render(<PriorityControl name="priority" />);

    expect(await screen.findByText('Issue created')).toBeInTheDocument();
    expect(await screen.findByTestId('priority-control-medium')).toBeInTheDocument();
    expect(await screen.findByTestId('priority-control-medium')).toBeInTheDocument();
  });
});
