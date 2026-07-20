import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {CollapsibleContent} from 'sentry/components/ai/chat/collapsibleContent';

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
