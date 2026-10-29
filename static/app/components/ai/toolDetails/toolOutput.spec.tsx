import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ToolOutput} from './toolOutput';

beforeEach(() => {
  Object.assign(navigator, {clipboard: {writeText: jest.fn().mockResolvedValue('')}});
});

it.each([
  [[20, 30], 'Array (2 items)'],
  [{answer: 20, status: 'complete'}, 'Object (2 fields)'],
])('shows the type and count for %p', (value, label) => {
  render(<ToolOutput value={JSON.stringify(value)} />);
  expect(screen.getByText(label)).toBeInTheDocument();
});

it('renders strings as plain text rather than markdown', () => {
  render(
    <ToolOutput
      value={JSON.stringify('**not bold**\n[not a link](https://example.com)')}
    />
  );
  expect(screen.getByText('Text')).toBeInTheDocument();
  expect(screen.getByText(/\*\*not bold\*\*/)).toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

it('preserves whitespace in text output', () => {
  render(<ToolOutput value={'  keep whitespace\n  second line  '} />);
  expect(screen.getByText(/keep whitespace/)).toHaveTextContent(
    '  keep whitespace\n  second line  ',
    {normalizeWhitespace: false}
  );
});

it.each([
  ['null', 'Null', 'Returned null'],
  ['""', 'Text', 'Empty string'],
  ['false', 'Boolean', 'false'],
  ['0', 'Number', '0'],
])('distinguishes %s from missing output', (value, label, content) => {
  render(<ToolOutput value={value} />);
  expect(screen.getByText(label)).toBeInTheDocument();
  expect(screen.getByText(content)).toBeInTheDocument();
  expect(screen.queryByText('No output for this span')).not.toBeInTheDocument();
});

it('distinguishes missing output from returned null', () => {
  render(<ToolOutput value={undefined} />);
  expect(screen.getByText('No output for this span')).toBeInTheDocument();
  expect(screen.queryByText('Returned null')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', {name: 'Copy output'})).not.toBeInTheDocument();
});

it.each([
  [{answer: 20}, '{\n  "answer": 20\n}'],
  [null, 'null'],
  ['', ''],
])('copies the returned value %p rather than its presentation', async (value, copied) => {
  render(<ToolOutput value={JSON.stringify(value)} />);
  await userEvent.click(screen.getByRole('button', {name: 'Copy output'}));
  expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(copied);
});
