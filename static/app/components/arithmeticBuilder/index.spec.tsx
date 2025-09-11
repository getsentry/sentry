import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ArithmeticBuilder} from 'sentry/components/arithmeticBuilder';
import {FieldKind, getFieldDefinition} from 'sentry/utils/fields';

const aggregations = ['avg', 'sum', 'count', 'count_unique'];

const functionArguments = [
  {name: 'span.duration', kind: FieldKind.MEASUREMENT},
  {name: 'span.self_time', kind: FieldKind.MEASUREMENT},
  {name: 'span.op', kind: FieldKind.TAG},
  {name: 'span.description', kind: FieldKind.TAG},
];

const getSpanFieldDefinition = (key: string) => {
  const argument = functionArguments.find(
    functionArgument => functionArgument.name === key
  );
  return getFieldDefinition(key, 'span', argument?.kind);
};

function ArithmeticBuilderWrapper({expression}: {expression: string}) {
  return (
    <ArithmeticBuilder
      aggregations={aggregations}
      functionArguments={functionArguments}
      getFieldDefinition={getSpanFieldDefinition}
      expression={expression}
    />
  );
}

describe('ArithmeticBuilder', () => {
  it('navigates between tokens with arrow keys', async () => {
    const expression = '( sum(span.duration) + count(span.self_time) )';
    render(<ArithmeticBuilderWrapper expression={expression} />);

    expect(screen.queryAllByRole('row')).toHaveLength(11);

    // the combobox inside the free text tokens will get the focus
    const freeTextTokens = screen.queryAllByRole('combobox', {name: 'Add a term'});
    expect(freeTextTokens).toHaveLength(6);

    // the delete button inside the parenthesis and operation tokens will get the focus
    const openParenToken = screen.queryByRole('gridcell', {name: 'Delete left'});
    const closeParenToken = screen.queryByRole('gridcell', {name: 'Delete right'});
    const addOpToken = screen.queryByRole('gridcell', {name: 'Delete +'});

    // the combobox inside the function tokens will get the focus
    const functionTokens = screen.queryAllByRole('combobox', {
      name: 'Select an attribute',
    });
    expect(functionTokens).toHaveLength(2);

    const tokens = [
      freeTextTokens[0]!,
      openParenToken,
      freeTextTokens[1]!,
      functionTokens[0]!,
      freeTextTokens[2]!,
      addOpToken,
      freeTextTokens[3]!,
      functionTokens[1]!,
      freeTextTokens[4]!,
      closeParenToken,
      freeTextTokens[5]!,
    ];

    let i = tokens.length - 1;
    const focus = () => expect(tokens[i]).toHaveFocus();

    await userEvent.click(tokens[i]!);
    await waitFor(focus);

    // shift focus all the way to the left
    while (i > 0) {
      i -= 1;
      await userEvent.keyboard('{ArrowLeft}');
      await waitFor(focus);
    }

    // then shift focus all the way to the left
    while (i < tokens.length - 1) {
      i += 1;
      await userEvent.keyboard('{ArrowRight}');
      await waitFor(focus);
    }

    await waitFor(() => expect(screen.queryAllByRole('row')).toHaveLength(1));
  }, 20_000);

  it('navigates between tokens with arrow keys with multi param functions', async () => {
    const expression = 'count_if(span.op,equals,db)';
    render(<ArithmeticBuilderWrapper expression={expression} />);

    expect(screen.queryAllByRole('row')).toHaveLength(3);

    // the combobox inside the free text tokens will get the focus
    const freeTextTokens = screen.queryAllByRole('combobox', {name: 'Add a term'});
    expect(freeTextTokens).toHaveLength(2);

    // the combobox inside the function tokens will get the focus
    const functionTokens = screen.queryAllByRole('combobox', {
      name: 'Select an attribute',
    });
    expect(functionTokens).toHaveLength(1);

    const tokens = [freeTextTokens[0]!, functionTokens[0]!, freeTextTokens[1]!];

    const secondArgToken = screen.queryAllByRole('combobox', {
      name: 'Select an option',
    });
    const thirdArgToken = screen.queryAllByRole('textbox', {
      name: 'Add a value',
    });
    const argTokens = [functionTokens[0]!, secondArgToken[0]!, thirdArgToken[0]!];

    const focus = (i: number) => expect(tokens[i]).toHaveFocus();
    const argFocus = (i: number) => expect(argTokens[i]).toHaveFocus();
    await userEvent.click(tokens[2]!);

    await waitFor(() => focus(2));

    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(() => focus(1));

    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(() => focus(0));

    // Shifts focus to argument tokens
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => argFocus(0));

    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => argFocus(1));

    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => argFocus(2));

    // Back to free text
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => focus(2));

    await waitFor(() => expect(screen.queryAllByRole('row')).toHaveLength(1));
  }, 20_000);

  it('can delete tokens with backspace', async () => {
    const expression = '( sum(span.duration) + count_if(span.op,equals,db))';
    render(<ArithmeticBuilderWrapper expression={expression} />);

    expect(screen.queryAllByRole('row')).toHaveLength(11);

    // the combobox inside the free text tokens will get the focus
    const freeTextTokens = screen.queryAllByRole('combobox', {name: 'Add a term'});
    expect(freeTextTokens).toHaveLength(6);

    // the delete button inside the parenthesis and operation tokens will get the focus
    const openParenToken = screen.queryByRole('gridcell', {name: 'Delete left'});
    const closeParenToken = screen.queryByRole('gridcell', {name: 'Delete right'});
    const addOpToken = screen.queryByRole('gridcell', {name: 'Delete +'});

    // the combobox inside the function tokens will get the focus
    const functionTokens = screen.getAllByRole('combobox', {
      name: 'Select an attribute',
    });
    expect(functionTokens).toHaveLength(2);

    const tokens = [
      freeTextTokens[0]!,
      openParenToken,
      freeTextTokens[1]!,
      functionTokens[0]!,
      freeTextTokens[2]!,
      addOpToken,
      freeTextTokens[3]!,
      functionTokens[1]!,
      freeTextTokens[4]!,
      closeParenToken,
      freeTextTokens[5]!,
    ];

    let i = tokens.length - 1;
    const focus = () => expect(tokens[i]).toHaveFocus();
    const presence = () => expect(tokens[i]).toBeInTheDocument();
    const deletion = () => expect(tokens[i]).not.toBeInTheDocument();

    await userEvent.click(tokens[i]!);
    await waitFor(focus);

    while (i > 0) {
      i -= 1;
      await waitFor(presence);
      await userEvent.keyboard('{Backspace}');
      await waitFor(focus);
      await userEvent.keyboard('{Backspace}');
      await waitFor(deletion);

      i -= 1;
      await waitFor(focus);
    }

    expect(screen.getAllByRole('row')).toHaveLength(1);
  });

  it('can delete tokens with delete', async () => {
    const expression = '( sum(span.duration) + count_if(span.op,equals,db) )';
    render(<ArithmeticBuilderWrapper expression={expression} />);

    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(11);

    // the combobox inside the free text tokens will get the focus
    const freeTextTokens = screen.getAllByRole('combobox', {name: 'Add a term'});
    expect(freeTextTokens).toHaveLength(6);

    const firstFreeText = () =>
      screen.getAllByRole('combobox', {name: 'Add a term'}).at(0)!;

    // Because we're deleting tokens from the start, we cannot get them
    // up front as they will change as we delete. We have to get the
    // element once we reach that position.
    const tokens: Array<() => HTMLElement | null> = [
      firstFreeText,
      () => screen.queryByRole('gridcell', {name: 'Delete left'}),
      firstFreeText,
      () => screen.queryByPlaceholderText('span.duration'),
      firstFreeText,
      () => screen.queryByRole('gridcell', {name: 'Delete +'}),
      firstFreeText,
      () => screen.queryByPlaceholderText('span.op'),
      firstFreeText,
      () => screen.queryByRole('gridcell', {name: 'Delete right'}),
      firstFreeText,
    ];

    let i = 0;
    const focus = () => expect(tokens[i]!()).toHaveFocus();
    const focus0 = () => expect(tokens[0]!()).toHaveFocus();
    const deletion = () => expect(tokens[i]!()).not.toBeInTheDocument();

    await userEvent.click(tokens[i]!()!);
    await waitFor(focus);

    while (i < tokens.length - 1) {
      i += 1;

      await waitFor(focus0);
      await userEvent.keyboard('{Delete}');
      await waitFor(focus);
      await userEvent.keyboard('{Delete}');
      await waitFor(deletion);

      i += 1;
    }

    expect(screen.getAllByRole('row')).toHaveLength(1);
  });
});
