import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import ArchiveActions from 'sentry/components/actions/archive';
import {GroupStatus} from 'sentry/types';

describe('ArchiveActions', () => {
  const onUpdate = jest.fn();
  afterEach(() => {
    jest.resetAllMocks();
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
      substatus: 'archived_until_condition_met',
    });
  });

  it('does render archive until occurrence options', async () => {
    render(<ArchiveActions onUpdate={onUpdate} disableArchiveUntilOccurrence={false} />);
    await userEvent.click(screen.getByRole('button', {name: 'Archive options'}));
    expect(
      screen.queryByRole('menuitemradio', {name: 'Until this occurs again\u2026'})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitemradio', {
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
});
