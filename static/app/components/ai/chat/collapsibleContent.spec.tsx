import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {CollapsibleContent, CollapsibleExpandAllContext} from './collapsibleContent';

describe('CollapsibleContent', () => {
  it('renders the title and keeps content in the DOM when collapsed', () => {
    render(
      <CollapsibleContent title="Thinking...">
        <span>reasoning body</span>
      </CollapsibleContent>
    );

    expect(screen.getByText('Thinking...')).toBeInTheDocument();
    // Collapsed <details> keeps children mounted so find-in-page can reveal them.
    const body = screen.getByText('reasoning body');
    expect(body).toBeInTheDocument();
    const details = body.closest('details');
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute('open');
  });

  it('starts expanded when defaultOpen is set', () => {
    render(
      <CollapsibleContent title="tag_name" defaultOpen>
        <span>body</span>
      </CollapsibleContent>
    );

    expect(screen.getByText('body').closest('details')).toHaveAttribute('open');
  });

  it('follows the open prop when controlled', async () => {
    const onOpenChange = jest.fn();
    const {rerender} = render(
      <CollapsibleContent title="Tool calls" open={false} onOpenChange={onOpenChange}>
        <span>body</span>
      </CollapsibleContent>
    );
    const details = screen.getByText('body').closest('details');
    expect(details).not.toHaveAttribute('open');

    // A click reports the change; the caller decides the open state.
    await userEvent.click(screen.getByText('Tool calls'));
    expect(onOpenChange).toHaveBeenCalledWith(true);

    rerender(
      <CollapsibleContent title="Tool calls" open onOpenChange={onOpenChange}>
        <span>body</span>
      </CollapsibleContent>
    );
    expect(details).toHaveAttribute('open');
  });

  it('fires onOpenChange with the new open state', async () => {
    const onOpenChange = jest.fn();
    render(
      <CollapsibleContent title="Thinking..." onOpenChange={onOpenChange}>
        <span>body</span>
      </CollapsibleContent>
    );

    await userEvent.click(screen.getByText('Thinking...'));

    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it('follows expand and collapse all, keeping a hand toggle until the next one', async () => {
    const onOpenChange = jest.fn();
    const {rerender} = render(
      <CollapsibleExpandAllContext value={{open: true, requestId: Symbol()}}>
        <CollapsibleContent title="Thinking..." onOpenChange={onOpenChange}>
          <span>body</span>
        </CollapsibleContent>
      </CollapsibleExpandAllContext>
    );
    const details = screen.getByText('body').closest('details');
    expect(details).toHaveAttribute('open');

    await userEvent.click(screen.getByText('Thinking...'));
    expect(details).not.toHaveAttribute('open');

    rerender(
      <CollapsibleExpandAllContext value={{open: true, requestId: Symbol()}}>
        <CollapsibleContent title="Thinking..." onOpenChange={onOpenChange}>
          <span>body</span>
        </CollapsibleContent>
      </CollapsibleExpandAllContext>
    );
    expect(details).toHaveAttribute('open');

    rerender(
      <CollapsibleExpandAllContext value={{open: false, requestId: Symbol()}}>
        <CollapsibleContent title="Thinking..." onOpenChange={onOpenChange}>
          <span>body</span>
        </CollapsibleContent>
      </CollapsibleExpandAllContext>
    );
    expect(details).not.toHaveAttribute('open');

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledTimes(1));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('goes back to its default when expand all is cleared', () => {
    const {rerender} = render(
      <CollapsibleExpandAllContext value={{open: true, requestId: Symbol()}}>
        <CollapsibleContent title="Thinking...">
          <span>body</span>
        </CollapsibleContent>
      </CollapsibleExpandAllContext>
    );
    const details = screen.getByText('body').closest('details');
    expect(details).toHaveAttribute('open');

    rerender(
      <CollapsibleExpandAllContext value={null}>
        <CollapsibleContent title="Thinking...">
          <span>body</span>
        </CollapsibleContent>
      </CollapsibleExpandAllContext>
    );
    expect(details).not.toHaveAttribute('open');
  });

  it('stops summary clicks from propagating to a wrapping handler', async () => {
    const onWrapperClick = jest.fn();
    render(
      <button type="button" onClick={onWrapperClick}>
        <CollapsibleContent title="Thinking...">
          <span>body</span>
        </CollapsibleContent>
      </button>
    );

    await userEvent.click(screen.getByText('Thinking...'));

    expect(onWrapperClick).not.toHaveBeenCalled();
  });
});
