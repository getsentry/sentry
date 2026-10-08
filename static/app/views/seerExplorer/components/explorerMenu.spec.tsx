import {useRef, useState} from 'react';

import {render, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {Input} from '@sentry/scraps/input';

import {useExplorerMenu} from './explorerMenu';

function ExplorerMenuInput({
  onNew,
  onKeyDown,
}: {
  onKeyDown: React.KeyboardEventHandler<HTMLInputElement>;
  onNew: () => void;
}) {
  const composerRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState('');
  const {menu} = useExplorerMenu({
    clearInput: () => setInputValue(''),
    composerRef,
    focusInput: () => composerRef.current?.focus(),
    inputAnchorRef: composerRef,
    inputValue,
    panelSize: 'max',
    slashCommandHandlers: {onNew, onFeedback: undefined},
  });

  return (
    <div data-seer-explorer-root="">
      {menu}
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
    const screen = within(ownerDocument.body);
    const user = userEvent.setup({document: ownerDocument});
    const input = screen.getByRole('textbox', {name: 'Ask Seer a question'});
    await user.type(input, '/new');
    expect(await screen.findByText('Start a new session')).toBeVisible();
    onKeyDown.mockClear();

    await user.keyboard(`{${key}}`);

    expect(onNew).toHaveBeenCalledTimes(key === 'Enter' ? 1 : 0);
    expect(onKeyDown).not.toHaveBeenCalled();
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
    expect(screen.queryByText('Start a new session')).not.toBeInTheDocument();
    unmount();
    container.remove();
  });
});
