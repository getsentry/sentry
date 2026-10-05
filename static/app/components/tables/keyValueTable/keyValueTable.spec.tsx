import {render, screen} from 'sentry-test/reactTestingLibrary';

import {KeyValueTable, KeyValueTableRow} from 'sentry/components/tables/keyValueTable';

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

  it('does not forward the type prop to the DOM when a row sets one', () => {
    render(
      <KeyValueTable>
        <KeyValueTableRow keyName="Status" value="Failing" type="error" />
      </KeyValueTable>
    );

    expect(screen.getByRole('term')).not.toHaveAttribute('type');
    expect(screen.getByRole('definition')).not.toHaveAttribute('type');
  });
});
