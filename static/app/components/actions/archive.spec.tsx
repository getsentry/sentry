import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import ArchiveActions from 'sentry/components/actions/archive';

describe('ArchiveActions', () => {
  const onUpdate = jest.fn();
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('archives the issue', async () => {
    render(<ArchiveActions onUpdate={onUpdate} />);
    await userEvent.click(screen.getByRole('button', {name: 'Archive'}));
    expect(onUpdate).toHaveBeenCalledWith({
      status: 'ignored',
      statusDetails: {untilEscalating: true},
    });
  });

  it('archives forever', async () => {
    render(<ArchiveActions onUpdate={onUpdate} />);

    await userEvent.click(screen.getByRole('button', {name: 'Archive options'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Forever'}));

    expect(onUpdate).toHaveBeenCalledWith({
      status: 'ignored',
      statusDetails: {},
    });
  });

  it('displays confirmation', async () => {
    render(
      <ArchiveActions
        onUpdate={onUpdate}
        shouldConfirm
        confirmMessage={() => 'Archive 5 issues'}
      />
    );
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Archive'}));
    // Confirm dialog
    expect(screen.getByText('Archive 5 issues')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    expect(onUpdate).toHaveBeenCalledWith({
      status: 'ignored',
      statusDetails: {untilEscalating: true},
    });
  });

  it('disables button and dropdown', () => {
    render(<ArchiveActions onUpdate={onUpdate} disabled />);
    expect(screen.getByRole('button', {name: 'Archive'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Archive options'})).toBeDisabled();
  });

  it('has ignore actions', async () => {
    render(<ArchiveActions onUpdate={onUpdate} />);
    await userEvent.click(screen.getByRole('button', {name: 'Archive options'}));
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'For\u2026'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: '30 minutes'}));

    expect(onUpdate).toHaveBeenCalledWith({
      status: 'ignored',
      statusDetails: {ignoreDuration: 30},
    });
  });
});
