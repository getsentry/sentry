import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  KeyValueTable,
  KeyValueTableCard,
  KeyValueTableRow,
} from 'sentry/components/tables/keyValueTable';

describe('KeyValueTable', () => {
  it('basic', () => {
    render(
      <KeyValueTable>
        <KeyValueTableRow keyName="Coffee" value="Black hot drink" />
        <KeyValueTableRow keyName="Milk" value={<a href="#">White cold drink</a>} />
      </KeyValueTable>
    );

    const terms = screen.getAllByRole('term');
    const definitions = screen.getAllByRole('definition');
    expect(terms[0]).toHaveTextContent('Coffee');
    expect(definitions[0]).toHaveTextContent('Black hot drink');
    expect(terms[1]).toHaveTextContent('Milk');
    expect(definitions[1]).toHaveTextContent('White cold drink');
  });
});

describe('KeyValueTableCard', () => {
  it('renders children when given no content items', () => {
    render(<KeyValueTableCard title="Body">{'Free-form content'}</KeyValueTableCard>);

    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(screen.getByText('Free-form content')).toBeInTheDocument();
  });

  it('renders nothing when given neither content items nor children', () => {
    const {container} = render(<KeyValueTableCard title="Body" />);

    expect(container).toBeEmptyDOMElement();
  });
});
