import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SnapshotApproveButton} from './snapshotApproveButton';

describe('SnapshotApproveButton', () => {
  it('is named even when the label is hidden at narrow widths', () => {
    render(<SnapshotApproveButton disabled={false} onApprove={jest.fn()} />);

    expect(screen.getByRole('button', {name: 'Approve'})).toBeEnabled();
  });

  it('approves on click', async () => {
    const onApprove = jest.fn();
    render(<SnapshotApproveButton disabled={false} onApprove={onApprove} />);

    await userEvent.click(screen.getByRole('button', {name: 'Approve'}));

    expect(onApprove).toHaveBeenCalledTimes(1);
  });

  it('does not approve while a request is in flight', async () => {
    const onApprove = jest.fn();
    render(<SnapshotApproveButton disabled onApprove={onApprove} />);

    await userEvent.click(screen.getByRole('button', {name: 'Approve'}));

    expect(onApprove).not.toHaveBeenCalled();
  });
});
