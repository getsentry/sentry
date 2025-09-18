import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  within,
} from 'sentry-test/reactTestingLibrary';

import ArchiveActions from 'sentry/components/actions/archive';
import {GroupStatus} from 'sentry/types/group';

describe('ArchiveActions', () => {
  const onUpdate = jest.fn();
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('archives the issue', async () => {
    render(<ArchiveActions onUpdate={onUpdate} />);
    await userEvent.click(screen.getByRole('button', {name: 'Archive'}));
    expect(onUpdate).toHaveBeenCalledWith({
      status: GroupStatus.IGNORED,
      statusDetails: {},
      substatus: 'archived_until_escalating',
    });
  });

  it('archives forever', async () => {
    render(<ArchiveActions onUpdate={onUpdate} />);

    await userEvent.click(screen.getByRole('button', {name: 'Archive options'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Forever'}));

    expect(onUpdate).toHaveBeenCalledWith({
      status: 'ignored',
      statusDetails: {},
      substatus: 'archived_forever',
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
      status: GroupStatus.IGNORED,
      statusDetails: {},
      substatus: 'archived_until_escalating',
    });
  });

  it('disables button and dropdown', async () => {
    render(<ArchiveActions onUpdate={onUpdate} disabled />);
    expect(screen.getByRole('button', {name: 'Archive'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Archive options'})).toBeDisabled();
    await userEvent.click(screen.getByRole('button', {name: 'Archive options'}));
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('archives until a custom date/time', async () => {
    render(<ArchiveActions onUpdate={onUpdate} />);
    await userEvent.click(screen.getByRole('button', {name: 'Archive options'}));
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'For\u2026'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: '30 minutes'}));

    expect(onUpdate).toHaveBeenCalledWith({
      status: 'ignored',
      statusDetails: {ignoreDuration: 30},
      substatus: 'archived_until_condition_met',
    });
  });

  it('does render archive until occurrence options', async () => {
    render(<ArchiveActions onUpdate={onUpdate} disableArchiveUntilOccurrence={false} />);
    await userEvent.click(screen.getByRole('button', {name: 'Archive options'}));
    expect(
      screen.getByRole('menuitemradio', {name: 'Until this occurs again\u2026'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', {
        name: 'Until this affects an additional\u2026',
      })
    ).toBeInTheDocument();
  });

  it('does not render archive until occurrence options', async () => {
    render(<ArchiveActions onUpdate={onUpdate} disableArchiveUntilOccurrence />);
    await userEvent.click(screen.getByRole('button', {name: 'Archive options'}));
    expect(
      screen.queryByRole('menuitemradio', {name: 'Until this occurs again\u2026'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitemradio', {
        name: 'Until this affects an additional\u2026',
      })
    ).not.toBeInTheDocument();
  });

  it('displays unarchive button', async () => {
    render(<ArchiveActions onUpdate={onUpdate} isArchived />);
    const button = screen.getByRole('button', {name: 'Unarchive'});
    expect(button).toBeInTheDocument();
    // Shows icon only
    expect(button).toHaveTextContent('');

    await userEvent.click(button);
    expect(onUpdate).toHaveBeenCalledWith({
      status: 'unresolved',
      statusDetails: {},
      substatus: 'ongoing',
    });
  });

  it('displays confirmation modal with message provided', async () => {
    render(
      <ArchiveActions
        onUpdate={onUpdate}
        shouldConfirm
        confirmMessage={() => 'confirm me'}
      />
    );
    renderGlobalModal();
    const button = screen.getByRole('button', {name: 'Archive'});
    await userEvent.click(button);

    expect(screen.getByText('confirm me')).toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId('confirm-button'));

    expect(onUpdate).toHaveBeenCalled();
  });

  it('can archive until a custom date/time', async () => {
    render(
      <ArchiveActions
        onUpdate={onUpdate}
        shouldConfirm
        confirmMessage={() => 'confirm me'}
      />
    );
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Archive options'}));
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'For…'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: /Custom/}));

    // opens modal
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {name: 'Archive'})
    );

    expect(onUpdate).toHaveBeenCalledWith({
      status: 'ignored',
      statusDetails: {
        ignoreDuration: expect.any(Number),
      },
      substatus: 'archived_until_condition_met',
    });
  });
});
