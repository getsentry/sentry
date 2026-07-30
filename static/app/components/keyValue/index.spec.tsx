import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {KeyValue, type KeyValueEntry} from 'sentry/components/keyValue';

const COFFEE: KeyValueEntry = {
  key: 'coffee',
  subject: 'Coffee',
  value: 'Black hot drink',
};
const MILK: KeyValueEntry = {key: 'milk', subject: 'Milk', value: 'White cold drink'};

const ITEMS: KeyValueEntry[] = [COFFEE, MILK];

describe('KeyValue', () => {
  it('renders terms and definitions in the list layout', () => {
    render(<KeyValue items={ITEMS} layout="list" />);

    const terms = screen.getAllByRole('term');
    const definitions = screen.getAllByRole('definition');

    expect(terms[0]).toHaveTextContent('Coffee');
    expect(definitions[0]).toHaveTextContent('Black hot drink');
    expect(terms[1]).toHaveTextContent('Milk');
    expect(definitions[1]).toHaveTextContent('White cold drink');
  });

  it('renders a compositional list when given KeyValue.Row children', () => {
    render(
      <KeyValue layout="list">
        <KeyValue.Row keyName="Coffee" value="Black hot drink" />
        <KeyValue.Row keyName="Milk" value={<a href="#milk">White cold drink</a>} />
      </KeyValue>
    );

    const terms = screen.getAllByRole('term');
    const definitions = screen.getAllByRole('definition');

    expect(terms[0]).toHaveTextContent('Coffee');
    expect(definitions[0]).toHaveTextContent('Black hot drink');
    expect(terms[1]).toHaveTextContent('Milk');
    expect(definitions[1]).toHaveTextContent('White cold drink');
  });

  it('renders a row per item in the detail layout', () => {
    render(<KeyValue items={ITEMS} layout="detail" />);

    const terms = screen.getAllByRole('term');
    const definitions = screen.getAllByRole('definition');

    expect(terms).toHaveLength(2);
    expect(terms[0]).toHaveTextContent('Coffee');
    expect(definitions[0]).toHaveTextContent('Black hot drink');
  });

  it('renders the title in a card', () => {
    render(<KeyValue items={ITEMS} card layout="detail" title="Drinks" />);

    expect(screen.getByText('Drinks')).toBeInTheDocument();
    expect(screen.getByText('Coffee')).toBeInTheDocument();
    expect(screen.getByText('Milk')).toBeInTheDocument();
  });

  it('renders nothing when there are no items', () => {
    const {container} = render(<KeyValue items={[]} layout="list" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('preserves the given order when sort is unset', () => {
    render(<KeyValue items={[ITEMS[1]!, ITEMS[0]!]} layout="list" />);

    const terms = screen.getAllByRole('term');

    expect(terms[0]).toHaveTextContent('Milk');
    expect(terms[1]).toHaveTextContent('Coffee');
  });

  it('orders entries by key when sorting by key', () => {
    const items: KeyValueEntry[] = [
      {key: 'Beta', subject: 'second', value: 'b'},
      {key: 'alpha', subject: 'first', value: 'a'},
    ];

    render(<KeyValue items={items} sort="key" layout="list" />);

    const terms = screen.getAllByRole('term');

    expect(terms[0]).toHaveTextContent('first');
    expect(terms[1]).toHaveTextContent('second');
  });

  it('orders entries by subject when sorting by subject', () => {
    render(<KeyValue items={[ITEMS[1]!, ITEMS[0]!]} sort="subject" layout="list" />);

    const terms = screen.getAllByRole('term');

    expect(terms[0]).toHaveTextContent('Coffee');
    expect(terms[1]).toHaveTextContent('Milk');
  });

  it('reveals the hidden entries when the truncation toggle is clicked', async () => {
    render(<KeyValue items={ITEMS} truncateLength={1} layout="list" />);

    expect(screen.queryByText('Milk')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Show more...'}));

    expect(screen.getByText('Milk')).toBeInTheDocument();
  });

  it('renders a link when the item has an action link', () => {
    const items: KeyValueEntry[] = [
      {
        action: {link: '/organizations/org-slug/issues/'},
        key: 'linked',
        subject: 'Linked',
        value: 'Go to issues',
      },
    ];

    render(<KeyValue items={items} layout="list" />);

    expect(screen.getByRole('link', {name: 'Go to issues'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/'
    );
  });

  it('renders plain text when the entry disables links', () => {
    const items: KeyValueEntry[] = [
      {
        action: {link: '/organizations/org-slug/issues/'},
        disableLink: true,
        key: 'linked',
        subject: 'Linked',
        value: 'Go to issues',
      },
    ];

    render(<KeyValue items={items} layout="list" />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Go to issues')).toBeInTheDocument();
  });

  it('renders the subject node instead of the subject when one is given', () => {
    const items: KeyValueEntry[] = [
      {
        key: 'custom',
        subject: 'Plain subject',
        subjectNode: <span>Custom subject</span>,
        value: 'value',
      },
    ];

    render(<KeyValue items={items} card layout="detail" />);

    expect(screen.getByText('Custom subject')).toBeInTheDocument();
    expect(screen.queryByText('Plain subject')).not.toBeInTheDocument();
  });

  it('renders each value on its own line when the item is multi-valued', () => {
    const items: KeyValueEntry[] = [
      {isMultiValue: true, key: 'tags', subject: 'Tags', value: ['one', 'two', 'three']},
    ];

    render(<KeyValue items={items} layout="detail" />);

    const lines = ['one', 'two', 'three'].map(
      value => screen.getByText(value).parentElement
    );

    expect(new Set(lines).size).toBe(3);
  });

  it('coerces non-string values into strings when the display is raw', () => {
    const items: KeyValueEntry[] = [
      {key: 'off', subject: 'Off', value: false},
      {key: 'empty', subject: 'Empty', value: null},
    ];

    render(<KeyValue items={items} layout="detail" />);

    const definitions = screen.getAllByRole('definition');

    expect(definitions[0]).toHaveTextContent('false');
    expect(definitions[1]).toHaveTextContent('null');
  });

  it('renders an empty cell when the value is an empty string', () => {
    const items: KeyValueEntry[] = [
      {key: 'a', subject: 'a', value: ''},
      {key: 'b', subject: 'b', value: 'y'},
    ];

    render(<KeyValue items={items} layout="detail" sort="key" />);

    const definitions = screen.getAllByRole('definition');

    expect(definitions[0]).toHaveTextContent('');
    expect(definitions[1]).toHaveTextContent('y');
  });

  it('sorts entries with non-string values when the display is expandable', () => {
    const items: KeyValueEntry[] = [
      {key: 'b', subject: 'b', value: {foo: 'bar'}},
      {key: 'a', subject: 'a', value: [3, 2, 1]},
    ];

    render(
      <KeyValue items={items} layout="detail" sort="key" valueDisplay="expandable" />
    );

    const terms = screen.getAllByRole('term');

    expect(terms[0]).toHaveTextContent('a');
    expect(terms[1]).toHaveTextContent('b');
  });

  it('applies the entry display over the list-wide display', () => {
    const items: KeyValueEntry[] = [
      {
        key: 'raw',
        subject: 'Raw',
        subjectDataTestId: 'raw-value',
        value: {nested: 'value'},
        valueDisplay: 'raw',
      },
      {
        key: 'formatted',
        subject: 'Formatted',
        subjectDataTestId: 'formatted-value',
        value: {nested: 'value'},
      },
    ];

    render(<KeyValue items={items} card layout="detail" />);

    expect(screen.getByTestId('raw-value')).toHaveTextContent('"nested": "value"');
    expect(screen.getByTestId('formatted-value')).toHaveTextContent('{1 item}');
  });

  it('renders KeyValue.Row children in the card shell', () => {
    render(
      <KeyValue card layout="detail" title="Drinks">
        <KeyValue.Row entry={COFFEE} />
      </KeyValue>
    );

    expect(screen.getByText('Drinks')).toBeInTheDocument();
    expect(screen.getByText('Coffee')).toBeInTheDocument();
  });

  it.each(['equal', 'fit', 'wide'] as const)(
    'renders every entry when the key column is %s',
    keyColumn => {
      render(<KeyValue items={ITEMS} keyColumn={keyColumn} layout="list" />);

      expect(screen.getAllByRole('term')).toHaveLength(2);
    }
  );

  it('collapses again once items arrive after the first render', async () => {
    const {rerender} = render(<KeyValue items={[]} truncateLength={1} layout="list" />);

    rerender(<KeyValue items={ITEMS} truncateLength={1} layout="list" />);

    expect(screen.queryByText('Milk')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Show more...'}));

    expect(screen.getByText('Milk')).toBeInTheDocument();
  });

  it('tints each row differently according to its status', () => {
    const items: KeyValueEntry[] = [
      {key: 'plain', subject: 'Plain', value: 'nothing to see'},
      {key: 'warned', status: 'warning', subject: 'Warned', value: 'careful'},
      {key: 'failed', status: 'error', subject: 'Failed', value: 'broken'},
    ];

    render(<KeyValue items={items} layout="list" />);

    const treatments = screen.getAllByRole('term').map(term => term.className);

    expect(new Set(treatments).size).toBe(3);
  });

  it('reveals the action button on hover', async () => {
    const items: KeyValueEntry[] = [
      {
        actionButton: <button type="button">Edit</button>,
        key: 'editable',
        subject: 'Editable',
        value: 'a value',
      },
    ];

    render(<KeyValue items={items} card layout="detail" />);

    const button = screen.getByRole('button', {name: 'Edit'});

    expect(button.parentElement).toHaveAttribute('data-reveal-on-hover');

    await userEvent.hover(button);

    expect(button).toBeVisible();
  });

  it('keeps the action button visible when it is always visible', () => {
    const items: KeyValueEntry[] = [
      {
        actionButton: <button type="button">Edit</button>,
        actionButtonAlwaysVisible: true,
        key: 'editable',
        subject: 'Editable',
        value: 'a value',
      },
    ];

    render(<KeyValue items={items} card layout="detail" />);

    expect(screen.getByRole('button', {name: 'Edit'}).parentElement).not.toHaveAttribute(
      'data-reveal-on-hover'
    );
  });

  it('distributes cards across columns in a container', () => {
    render(
      <KeyValue.Container>
        <KeyValue items={ITEMS} card layout="detail" title="First" />
        <KeyValue items={ITEMS} card layout="detail" title="Second" />
      </KeyValue.Container>
    );

    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('renders error annotations when the entry has errors', () => {
    const items: KeyValueEntry[] = [
      {
        errors: [['invalid_data', {reason: 'This value is invalid'}]],
        key: 'broken',
        subject: 'Broken',
        value: '',
      },
    ];

    render(<KeyValue items={items} card layout="detail" />);

    expect(screen.getByTestId('annotated-text-error-icon')).toBeInTheDocument();
  });
});
