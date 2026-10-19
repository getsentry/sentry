import {render, screen} from 'sentry-test/reactTestingLibrary';

import {AIToolOutput} from './aiToolOutput';

it('labels objects with their field count and renders a pretty tree', () => {
  render(<AIToolOutput value={JSON.stringify({answer: 20, status: 'complete'})} />);
  expect(screen.getByText('Object · 2 fields')).toBeInTheDocument();
  expect(screen.getByText(/complete/)).toBeInTheDocument();
});

it.each([
  [[], 'Array · 0 items'],
  [[20], 'Array · 1 item'],
  [[20, 30], 'Array · 2 items'],
  [{}, 'Object · 0 fields'],
  [{answer: 20}, 'Object · 1 field'],
])('shows the type and count for %p', (value, label) => {
  render(<AIToolOutput value={JSON.stringify(value)} />);
  expect(screen.getByText(label)).toBeInTheDocument();
});

it('renders strings as plain text rather than markdown', () => {
  render(
    <AIToolOutput
      value={JSON.stringify('**not bold**\n[not a link](https://example.com)')}
    />
  );
  expect(screen.getByText('Text')).toBeInTheDocument();
  expect(screen.getByText(/\*\*not bold\*\*/)).toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

it('preserves non-JSON text', () => {
  render(<AIToolOutput value="plain result" />);
  expect(screen.getByText('Text')).toBeInTheDocument();
  expect(screen.getByText('plain result')).toBeInTheDocument();
});

it.each([
  ['null', 'Null', 'Returned null'],
  ['""', 'Text', 'Empty string'],
  ['false', 'Boolean', 'false'],
  ['0', 'Number', '0'],
])('distinguishes %s from missing output', (value, label, content) => {
  render(<AIToolOutput value={value} />);
  expect(screen.getByText(label)).toBeInTheDocument();
  expect(screen.getByText(content)).toBeInTheDocument();
  expect(screen.queryByText('No output for this span')).not.toBeInTheDocument();
});

it.each([false, 0, ''])('keeps raw falsy output %p visible', value => {
  render(<AIToolOutput value={value} />);
  expect(
    screen.getByText(value === '' ? 'Empty string' : String(value))
  ).toBeInTheDocument();
});

it('distinguishes missing output from returned null', () => {
  render(<AIToolOutput value={undefined} />);
  expect(screen.getByText('No output for this span')).toBeInTheDocument();
  expect(screen.queryByText('Returned null')).not.toBeInTheDocument();
});
