import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import KeyValueList from 'sentry/components/events/interfaces/keyValueList';

describe('KeyValueList', function () {
  it('should render a definition list of key/value pairs', function () {
    const data = [
      {key: 'a', value: 'x', subject: 'a'},
      {key: 'b', value: 'y', subject: 'b'},
    ];

    render(<KeyValueList data={data} />);

    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(2);

    const firstColumn = within(rows[0]!).getAllByRole('cell');
    expect(firstColumn[0]).toHaveTextContent('a');
    expect(firstColumn[1]).toHaveTextContent('x');

    const secondColumn = within(rows[1]!).getAllByRole('cell');
    expect(secondColumn[0]).toHaveTextContent('b');
    expect(secondColumn[1]).toHaveTextContent('y');
  });

  it('should sort sort key/value pairs', function () {
    const data = [
      {key: 'b', value: 'y', subject: 'b'},
      {key: 'a', value: 'x', subject: 'a'},
    ];

    render(<KeyValueList data={data} />);

    const rows = screen.getAllByRole('row');

    const firstColumn = within(rows[0]!).getAllByRole('cell');
    expect(firstColumn[0]).toHaveTextContent('a');
    expect(firstColumn[1]).toHaveTextContent('x');

    const secondColumn = within(rows[1]!).getAllByRole('cell');
    expect(secondColumn[0]).toHaveTextContent('b');
    expect(secondColumn[1]).toHaveTextContent('y');
  });

  it('should use a single space for values that are an empty string', function () {
    const data = [
      {key: 'b', value: 'y', subject: 'b'},
      {key: 'a', value: '', subject: 'a'}, // empty string
    ];

    render(<KeyValueList data={data} />);

    const rows = screen.getAllByRole('row');

    const firstColumn = within(rows[0]!).getAllByRole('cell');
    expect(firstColumn[0]).toHaveTextContent('a');
    expect(firstColumn[1]).toHaveTextContent(''); // empty string

    const secondColumn = within(rows[1]!).getAllByRole('cell');
    expect(secondColumn[0]).toHaveTextContent('b');
    expect(secondColumn[1]).toHaveTextContent('y');
  });

  it('can sort key/value pairs with non-string values', function () {
    const data = [
      {key: 'b', value: {foo: 'bar'}, subject: 'b'},
      {key: 'a', value: [3, 2, 1], subject: 'a'},
    ];

    render(<KeyValueList isContextData data={data} />);

    const rows = screen.getAllByRole('row');

    // Ignore values, more interested in if keys rendered + are sorted
    const firstColumn = within(rows[0]!).getAllByRole('cell');
    expect(firstColumn[0]).toHaveTextContent('a');

    const secondColumn = within(rows[1]!).getAllByRole('cell');
    expect(secondColumn[0]).toHaveTextContent('b');
  });

  it('should coerce non-strings into strings', function () {
    const data = [{key: 'a', value: false, subject: 'a'}];

    render(<KeyValueList data={data} />);

    const cells = screen.getAllByRole('cell');
    expect(cells[0]).toHaveTextContent('a');
    expect(cells[1]).toHaveTextContent('false');
  });

  it("shouldn't blow up on null", function () {
    const data = [{key: 'a', value: null, subject: 'a'}];

    render(<KeyValueList data={data} />);

    const cells = screen.getAllByRole('cell');
    expect(cells[0]).toHaveTextContent('a');
    expect(cells[1]).toHaveTextContent('null');
  });
});
