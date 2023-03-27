import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Column, generateFieldAsString} from 'sentry/utils/discover/fields';
import ArithmeticInput from 'sentry/views/discover/table/arithmeticInput';

describe('ArithmeticInput', function () {
  const operators = ['+', '-', '*', '/', '(', ')'];

  const numericColumns: Column[] = [
    {kind: 'field', field: 'transaction.duration'},
    {kind: 'field', field: 'measurements.lcp'},
    {kind: 'field', field: 'spans.http'},
    {kind: 'function', function: ['p50', '', undefined, undefined]},
    {
      kind: 'function',
      function: ['percentile', 'transaction.duration', '0.25', undefined],
    },
    {kind: 'function', function: ['count', '', undefined, undefined]},
  ];

  const columns: Column[] = [
    ...numericColumns,
    // these columns will not be rendered in the dropdown
    {kind: 'function', function: ['any', 'transaction.duration', undefined, undefined]},
    {kind: 'field', field: 'transaction'},
    {kind: 'function', function: ['failure_rate', '', undefined, undefined]},
    {kind: 'equation', field: 'transaction.duration+measurements.lcp'},
  ];

  it('can toggle autocomplete dropdown on focus and blur', async function () {
    render(
      <ArithmeticInput
        name="refinement"
        key="parameter:text"
        type="text"
        required
        value=""
        onUpdate={jest.fn()}
        options={columns}
      />
    );

    expect(screen.queryByText('Fields')).not.toBeInTheDocument();

    // focus the input
    await userEvent.click(screen.getByRole('textbox'));

    expect(screen.getByText('Fields')).toBeInTheDocument();

    // moves focus away from the input
    await userEvent.tab();

    expect(screen.queryByText('Fields')).not.toBeInTheDocument();
  });

  it('renders only numeric options in autocomplete', async function () {
    render(
      <ArithmeticInput
        name="refinement"
        key="parameter:text"
        type="text"
        required
        value=""
        onUpdate={jest.fn()}
        options={columns}
      />
    );

    // focus the input
    await userEvent.click(screen.getByRole('textbox'));

    const listItems = screen.getAllByRole('listitem');

    // options + headers that are inside listitem
    expect(listItems).toHaveLength(numericColumns.length + operators.length + 2);

    const options = listItems.filter(
      item => item.textContent !== 'Fields' && item.textContent !== 'Operators'
    );

    options.forEach((option, i) => {
      if (i < numericColumns.length) {
        expect(option).toHaveTextContent(generateFieldAsString(numericColumns[i]));
        return;
      }
      expect(option).toHaveTextContent(operators[i - numericColumns.length]);
    });
  });

  it('can use keyboard to select an option', async function () {
    render(
      <ArithmeticInput
        name="refinement"
        key="parameter:text"
        type="text"
        required
        value=""
        onUpdate={jest.fn()}
        options={columns}
      />
    );

    // focus the input
    await userEvent.click(screen.getByRole('textbox'));

    for (const column of numericColumns) {
      await userEvent.keyboard('{ArrowDown}');
      expect(
        screen.getByRole('listitem', {name: generateFieldAsString(column)})
      ).toHaveClass('active', {exact: false});
    }

    for (const operator of operators) {
      await userEvent.keyboard('{ArrowDown}');
      expect(screen.getByRole('listitem', {name: operator})).toHaveClass('active', {
        exact: false,
      });
    }

    // wrap around to the first option again
    await userEvent.keyboard('{ArrowDown}');

    for (const operator of [...operators].reverse()) {
      await userEvent.keyboard('{ArrowUp}');
      expect(screen.getByRole('listitem', {name: operator})).toHaveClass('active', {
        exact: false,
      });
    }

    for (const column of [...numericColumns].reverse()) {
      await userEvent.keyboard('{ArrowUp}');
      expect(
        screen.getByRole('listitem', {name: generateFieldAsString(column)})
      ).toHaveClass('active', {
        exact: false,
      });
    }

    // the update is buffered until blur happens
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{Escape}');

    expect(screen.getByRole('textbox')).toHaveValue(
      `${generateFieldAsString(numericColumns[0])} `
    );
  });

  it('can use mouse to select an option', async function () {
    render(
      <ArithmeticInput
        name="refinement"
        key="parameter:text"
        type="text"
        required
        value=""
        onUpdate={jest.fn()}
        options={columns}
      />
    );

    await userEvent.click(screen.getByRole('textbox'));

    await userEvent.click(screen.getByText(generateFieldAsString(numericColumns[2])));

    expect(screen.getByRole('textbox')).toHaveValue(
      `${generateFieldAsString(numericColumns[2])} `
    );
  });

  it('autocompletes the current term when it is in the front', async function () {
    render(
      <ArithmeticInput
        name="refinement"
        key="parameter:text"
        type="text"
        required
        value=""
        onUpdate={jest.fn()}
        options={columns}
      />
    );

    const element = screen.getByRole('textbox') as HTMLInputElement;

    await userEvent.type(element, 'lcp + transaction.duration');
    await userEvent.type(element, '{ArrowLeft>24}');
    await userEvent.click(screen.getByText('measurements.lcp'));

    expect(screen.getByRole('textbox')).toHaveValue(
      'measurements.lcp  + transaction.duration'
    );
  });

  it('autocompletes the current term when it is in the end', async function () {
    render(
      <ArithmeticInput
        name="refinement"
        key="parameter:text"
        type="text"
        required
        value=""
        onUpdate={jest.fn()}
        options={columns}
      />
    );

    await userEvent.type(screen.getByRole('textbox'), 'transaction.duration + lcp');

    await userEvent.click(screen.getByText('measurements.lcp'));

    expect(screen.getByRole('textbox')).toHaveValue(
      'transaction.duration + measurements.lcp '
    );
  });

  it('handles autocomplete on invalid term', async function () {
    render(
      <ArithmeticInput
        name="refinement"
        key="parameter:text"
        type="text"
        required
        value=""
        onUpdate={jest.fn()}
        options={columns}
      />
    );

    // focus the input
    await userEvent.type(screen.getByRole('textbox'), 'foo + bar');
    await userEvent.keyboard('{keydown}');

    expect(screen.getAllByText('No items found')).toHaveLength(2);
  });

  it('can hide Fields options', async function () {
    render(
      <ArithmeticInput
        name="refinement"
        type="text"
        required
        value=""
        onUpdate={() => {}}
        options={[]}
        hideFieldOptions
      />
    );

    // focus the input
    await userEvent.click(screen.getByRole('textbox'));

    expect(screen.getByText('Operators')).toBeInTheDocument();
    expect(screen.queryByText('Fields')).not.toBeInTheDocument();
  });
});
