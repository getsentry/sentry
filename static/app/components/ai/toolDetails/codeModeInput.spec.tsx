import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {CodeModeInput} from './codeModeInput';

beforeEach(() => {
  Object.assign(navigator, {clipboard: {writeText: jest.fn().mockResolvedValue('')}});
});

it('always formats JavaScript, with only the standard copy control', async () => {
  const {rerender} = render(
    <CodeModeInput code="const answer=42;" language="javascript" />
  );
  expect(
    await screen.findByText(
      (_, element) =>
        element?.tagName === 'CODE' && element.textContent === 'const answer = 42;'
    )
  ).toBeInTheDocument();
  expect(screen.getByText('javascript')).toBeInTheDocument();
  expect(screen.getByRole('button', {name: 'Copy snippet'})).toBeInTheDocument();
  expect(screen.getAllByRole('button')).toHaveLength(1);
  await userEvent.click(screen.getByRole('button', {name: 'Copy snippet'}));
  expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith('const answer = 42;');

  rerender(<CodeModeInput code="const answer=43;" language="javascript" />);
  expect(
    await screen.findByText(
      (_, element) =>
        element?.tagName === 'CODE' && element.textContent === 'const answer = 43;'
    )
  ).toBeInTheDocument();
});

it('shows Python without applying a JavaScript formatter', () => {
  render(<CodeModeInput code="print(42)" language="python" />);
  expect(
    screen.getByText(
      (_, element) => element?.tagName === 'CODE' && element.textContent === 'print(42)'
    )
  ).toBeInTheDocument();
  expect(screen.getAllByRole('button')).toHaveLength(1);
});
