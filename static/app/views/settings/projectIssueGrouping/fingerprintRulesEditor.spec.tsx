import {useState} from 'react';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {FingerprintRulesEditor} from 'sentry/views/settings/projectIssueGrouping/fingerprintRulesEditor';

jest.unmock('@tanstack/react-pacer');

function Editor({initialValue = ''}: {initialValue?: string}) {
  const [value, setValue] = useState(initialValue);
  return (
    <FingerprintRulesEditor
      aria-label="Fingerprint rules"
      value={value}
      onChange={setValue}
    />
  );
}

describe('FingerprintRulesEditor', () => {
  it('summarizes problems and selects one picked from the list', async () => {
    render(
      <Editor
        initialValue={'error.type:A -> a title=T\nerror.type:B => b\nerror.type:C-> c'}
      />
    );

    const summary = screen.getByRole('button', {name: /2 errors.*1 warning/});
    expect(screen.getByText('Use "->" instead of "=>"')).not.toBeVisible();

    await userEvent.click(summary);
    expect(
      screen.getByText('Unquoted title becomes part of the fingerprint')
    ).toBeVisible();
    expect(screen.getByText('Use "->" instead of "=>"')).toBeVisible();
    expect(screen.getByText('Add a space before "->"')).toBeVisible();

    await userEvent.click(screen.getByRole('button', {name: 'Line 2'}));

    const textbox = screen.getByRole<HTMLTextAreaElement>('textbox', {
      name: 'Fingerprint rules',
    });
    expect(textbox).toHaveFocus();
    expect(textbox.value.slice(textbox.selectionStart, textbox.selectionEnd)).toBe('=>');
  });

  it('waits for typing to pause before showing problems', async () => {
    render(<Editor />);

    await userEvent.type(
      screen.getByRole('textbox', {name: 'Fingerprint rules'}),
      'error.type:A'
    );

    expect(screen.queryByRole('button', {name: /1 error/})).not.toBeInTheDocument();
    expect(await screen.findByRole('button', {name: /1 error/})).toBeInTheDocument();
  });

  it('shows no summary for valid rules', () => {
    render(<Editor initialValue="error.type:A -> a, {{ default }}" />);

    expect(screen.queryByRole('button', {name: /error|warning/})).not.toBeInTheDocument();
  });
});
