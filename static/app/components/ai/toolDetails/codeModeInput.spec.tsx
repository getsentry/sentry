import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {CodeModeInput} from './codeModeInput';

beforeEach(() => {
  Object.assign(navigator, {clipboard: {writeText: jest.fn().mockResolvedValue('')}});
});

it('displays and copies formatted JavaScript', async () => {
  render(<CodeModeInput code="const answer=42;" language="javascript" />);
  expect(
    await screen.findByText(
      (_, element) =>
        element?.tagName === 'CODE' && element.textContent === 'const answer = 42;'
    )
  ).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', {name: 'Copy snippet'}));
  expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith('const answer = 42;');
});

it('shows Python without applying a JavaScript formatter', () => {
  render(<CodeModeInput code="print(42)" language="python" />);
  expect(
    screen.getByText(
      (_, element) => element?.tagName === 'CODE' && element.textContent === 'print(42)'
    )
  ).toBeInTheDocument();
});

it('highlights unlabeled code as JavaScript but keeps the source as-is', () => {
  const code = 'for x in range(3):\n    if x:\n        print(x)';
  render(<CodeModeInput code={code} />);
  expect(screen.getByText('code')).toBeInTheDocument();
  expect(
    screen.getByText(
      (_, element) => element?.tagName === 'CODE' && element.textContent === code
    )
  ).toHaveClass('language-javascript');
});
