import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

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

  it('expands when openWhen turns true after mounting', () => {
    const {rerender} = render(
      <CollapsibleContent title="Tool calls">
        <span>body</span>
      </CollapsibleContent>
    );
    const details = screen.getByText('body').closest('details');
    expect(details).not.toHaveAttribute('open');

    rerender(
      <CollapsibleContent title="Tool calls" openWhen>
        <span>body</span>
      </CollapsibleContent>
    );

    expect(details).toHaveAttribute('open');
  });

  it('fires onToggle with the new open state', async () => {
    const onToggle = jest.fn();
    render(
      <CollapsibleContent title="Thinking..." onToggle={onToggle}>
        <span>body</span>
      </CollapsibleContent>
    );

    await userEvent.click(screen.getByText('Thinking...'));

    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('follows expand and collapse all, keeping a hand toggle until the next one', async () => {
    const {rerender} = render(
      <CollapsibleExpandAllContext value={{generation: 1, open: true}}>
        <CollapsibleContent title="Thinking...">
          <span>body</span>
        </CollapsibleContent>
      </CollapsibleExpandAllContext>
    );
    const details = screen.getByText('body').closest('details');
    expect(details).toHaveAttribute('open');

    await userEvent.click(screen.getByText('Thinking...'));
    expect(details).not.toHaveAttribute('open');

    rerender(
      <CollapsibleExpandAllContext value={{generation: 2, open: true}}>
        <CollapsibleContent title="Thinking...">
          <span>body</span>
        </CollapsibleContent>
      </CollapsibleExpandAllContext>
    );
    expect(details).toHaveAttribute('open');

    rerender(
      <CollapsibleExpandAllContext value={{generation: 3, open: false}}>
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
