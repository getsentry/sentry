import {useRef, useState} from 'react';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {Input} from '@sentry/scraps/input';

import {useExplorerMenu} from './explorerMenu';

function ExplorerMenuInput({
  onNew,
  onKeyDown,
  canInvestigate,
}: {
  onKeyDown: React.KeyboardEventHandler<HTMLInputElement>;
  onNew: () => void;
  canInvestigate?: boolean;
}) {
  const composerRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState('');
  const {menu, toolbarMenu} = useExplorerMenu({
    clearInput: () => setInputValue(''),
    completeInput: setInputValue,
    composerRef,
    focusInput: () => composerRef.current?.focus(),
    inputAnchorRef: composerRef,
    inputValue,
    panelSize: 'max',
    slashCommandHandlers: {onNew, onFeedback: undefined, canInvestigate},
  });

  return (
    <div data-seer-explorer-root="">
      {menu}
      {toolbarMenu}
      <Input
        ref={composerRef}
        aria-label="Ask Seer a question"
        value={inputValue}
        onChange={event => setInputValue(event.target.value)}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}

describe('Explorer toolbar menu', () => {
  it('opens and dismisses commands without changing the draft', async () => {
    render(<ExplorerMenuInput onNew={jest.fn()} onKeyDown={jest.fn()} />);
    const input = screen.getByRole('textbox', {name: 'Ask Seer a question'});
    await userEvent.type(input, 'Keep my draft');

    await userEvent.click(screen.getByRole('button', {name: 'Add to conversation'}));
    expect(screen.queryByRole('menuitemradio', {name: /\/new/})).not.toBeInTheDocument();
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Commands'}));

    expect(await screen.findByRole('menuitemradio', {name: /\/new/})).toBeVisible();
    expect(input).toHaveValue('Keep my draft');
    await userEvent.keyboard('{Escape}{Escape}');
    expect(screen.queryByRole('menuitemradio', {name: /\/new/})).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitemradio', {name: 'Commands'})
    ).not.toBeInTheDocument();
    expect(input).toHaveValue('Keep my draft');
  });

  it('runs the selected command and focuses the input', async () => {
    const onNew = jest.fn();
    render(<ExplorerMenuInput onNew={onNew} onKeyDown={jest.fn()} />);
    await userEvent.click(screen.getByRole('button', {name: 'Add to conversation'}));
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Commands'}));
    await userEvent.click(await screen.findByRole('menuitemradio', {name: /\/new/}));

    expect(onNew).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('textbox', {name: 'Ask Seer a question'})).toHaveFocus();
  });

  it('completes investigate without running a command', async () => {
    const onNew = jest.fn();
    render(<ExplorerMenuInput onNew={onNew} onKeyDown={jest.fn()} canInvestigate />);
    await userEvent.click(screen.getByRole('button', {name: 'Add to conversation'}));
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Commands'}));
    await userEvent.click(
      await screen.findByRole('menuitemradio', {name: /\/investigate/})
    );

    expect(screen.getByRole('textbox', {name: 'Ask Seer a question'})).toHaveValue(
      '/investigate '
    );
    expect(onNew).not.toHaveBeenCalled();
  });

  it('uses toolbar keyboard navigation while a slash command is partially typed', async () => {
    HTMLElement.prototype.scrollIntoView = jest.fn();
    const onNew = jest.fn();
    render(<ExplorerMenuInput onNew={onNew} onKeyDown={jest.fn()} canInvestigate />);
    const input = screen.getByRole('textbox', {name: 'Ask Seer a question'});
    await userEvent.type(input, '/n');
    await userEvent.click(screen.getByRole('button', {name: 'Add to conversation'}));
    await screen.findByRole('menuitemradio', {name: 'Commands'});

    await userEvent.keyboard('{ArrowRight}{ArrowDown}{Enter}');

    expect(input).toHaveValue('/investigate ');
    expect(onNew).not.toHaveBeenCalled();
  });
});

describe.each(['main', 'pop-out'] as const)('Explorer menu in %s document', surface => {
  let iframe: HTMLIFrameElement | undefined;
  let ownerDocument: Document;

  beforeEach(() => {
    if (surface === 'pop-out') {
      iframe = document.createElement('iframe');
      document.body.append(iframe);
      if (!iframe.contentDocument) {
        throw new Error('Missing iframe document');
      }
      ownerDocument = iframe.contentDocument;
    } else {
      ownerDocument = document;
    }
    Object.defineProperty(
      ownerDocument.defaultView?.Element.prototype,
      'scrollIntoView',
      {
        configurable: true,
        value: jest.fn(),
      }
    );
  });

  afterEach(() => {
    iframe?.remove();
  });

  it.each(['Enter', 'Escape'])('handles %s before the input handler', async key => {
    const onNew = jest.fn();
    const onKeyDown = jest.fn();
    const container = ownerDocument.createElement('div');
    ownerDocument.body.append(container);
    const {unmount} = render(<ExplorerMenuInput onNew={onNew} onKeyDown={onKeyDown} />, {
      container,
    });
    const view = within(ownerDocument.body);
    const user = userEvent.setup({document: ownerDocument});
    const input = view.getByRole('textbox', {name: 'Ask Seer a question'});
    await user.type(input, '/new');
    expect(await view.findByText('Start a new session')).toBeVisible();
    onKeyDown.mockClear();

    await user.keyboard(`{${key}}`);

    expect(onNew).toHaveBeenCalledTimes(key === 'Enter' ? 1 : 0);
    expect(onKeyDown).not.toHaveBeenCalled();
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
    expect(view.queryByText('Start a new session')).not.toBeInTheDocument();
    unmount();
    container.remove();
  });
});
