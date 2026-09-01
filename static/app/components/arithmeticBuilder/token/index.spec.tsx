import type {Dispatch} from 'react';
import {useCallback} from 'react';

import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import type {ArithmeticBuilderAction} from 'sentry/components/arithmeticBuilder/action';
import {useArithmeticBuilderAction} from 'sentry/components/arithmeticBuilder/action';
import {ArithmeticBuilderContext} from 'sentry/components/arithmeticBuilder/context';
import {
  Operator,
  Parenthesis,
  TokenKind,
} from 'sentry/components/arithmeticBuilder/token';
import {TokenGrid} from 'sentry/components/arithmeticBuilder/token/grid';
import type {GetTagValues} from 'sentry/components/searchQueryBuilder';
import {FieldKind, getExploreEquationFieldDefinition} from 'sentry/utils/fields';

const aggregations = ['avg', 'avg_if', 'sum', 'epm', 'count', 'count_unique', 'count_if'];

const functionArguments = [
  {name: 'span.duration', kind: FieldKind.MEASUREMENT},
  {name: 'span.self_time', kind: FieldKind.MEASUREMENT},
  {name: 'span.op', kind: FieldKind.TAG},
  {name: 'span.description', kind: FieldKind.TAG},
];

const getSuggestedKey = (key: string) => {
  switch (key) {
    case 'duration':
    case 'self_time':
    case 'op':
    case 'description':
      return `span.${key}`;
    default:
      return null;
  }
};

interface TokensProp {
  expression: string;
  dispatch?: Dispatch<ArithmeticBuilderAction>;
  getFilterTagValues?: GetTagValues;
  /**
   * Mirrors `explore-conditional-aggregates`. Defaults to on so EAP filter-first
   * coverage stays the default; Discover 3/4-arg `_if` tests pass `false`.
   */
  hasConditionalAggregates?: boolean;
  references?: Set<string>;
}

function Tokens(props: TokensProp) {
  const hasConditionalAggregates = props.hasConditionalAggregates ?? true;
  const {state, dispatch} = useArithmeticBuilderAction({
    initialExpression: props.expression,
    references: props.references,
  });

  const wrappedDispatch = useCallback(
    (action: ArithmeticBuilderAction) => {
      dispatch(action);
      props.dispatch?.(action);
    },
    [dispatch, props]
  );

  const getSpanFieldDefinition = useCallback(
    (key: string, attributeTexts?: readonly string[]) => {
      const argument = functionArguments.find(
        functionArgument => functionArgument.name === key
      );

      return getExploreEquationFieldDefinition(
        key,
        argument?.kind,
        hasConditionalAggregates,
        attributeTexts
      );
    },
    [hasConditionalAggregates]
  );

  return (
    <ArithmeticBuilderContext
      value={{
        dispatch: wrappedDispatch,
        focusOverride: state.focusOverride,
        aggregations,
        functionArguments,
        getFieldDefinition: getSpanFieldDefinition,
        getFilterTagValues: props.getFilterTagValues,
        getSuggestedKey,
        references: props.references,
      }}
    >
      <TokenGrid tokens={state.expression.tokens} />
    </ArithmeticBuilderContext>
  );
}

function getLastInput() {
  const input = screen.getAllByLabelText('Add a term').at(-1);

  expect(input).toBeInTheDocument();

  return input!;
}

describe('token', () => {
  it('focuses the last input when clicking empty space in the field', async () => {
    render(<Tokens expression="avg_if(span.duration,span.op,db)" />);

    await userEvent.click(screen.getByRole('grid', {name: 'Enter an equation'}));

    expect(getLastInput()).toHaveFocus();
  });
  describe('ArithmeticTokenFreeText', () => {
    it('renders default place holder', async () => {
      render(<Tokens expression="" />);

      const input = screen.getByRole('combobox', {
        name: 'Add a term',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);
      expect(input).toHaveFocus();
      expect(input).toHaveAttribute('placeholder', 'Enter equation');
      expect(input).toHaveValue('');
    });

    it('allow selecting function using mouse', async () => {
      render(<Tokens expression="" />);

      const input = screen.getByRole('combobox', {
        name: 'Add a term',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);

      // typing should reduce the options avilable in the autocomplete
      expect(screen.getAllByRole('option')).toHaveLength(aggregations.length + 1);
      await userEvent.type(input, 'avg');
      expect(screen.getAllByRole('option')).toHaveLength(2);

      await userEvent.click(screen.getByRole('option', {name: 'avg'}));

      expect(await screen.findByLabelText('avg(span.duration)')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByLabelText('Select an attribute')).toHaveFocus();
      });
    });

    it('allow selecting function using keyboard', async () => {
      render(<Tokens expression="" />);

      const input = screen.getByRole('combobox', {
        name: 'Add a term',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);
      // typing should reduce the options avilable in the autocomplete
      expect(screen.getAllByRole('option')).toHaveLength(aggregations.length + 1);
      await userEvent.type(input, 'avg');
      expect(screen.getAllByRole('option')).toHaveLength(2);

      await userEvent.type(input, '{ArrowDown}{Enter}');
      expect(
        await screen.findByRole('row', {
          name: 'avg(span.duration)',
        })
      ).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByLabelText('Select an attribute')).toHaveFocus();
      });
    });

    it('fills in every argument when selecting avg_if', async () => {
      render(<Tokens expression="" hasConditionalAggregates={false} />);

      const input = screen.getByRole('combobox', {name: 'Add a term'});

      await userEvent.click(input);
      await userEvent.type(input, 'avg_if');
      await userEvent.click(screen.getByRole('option', {name: 'avg_if'}));

      expect(
        await screen.findByRole('row', {
          name: 'avg_if(span.duration,span.op,equals,db)',
        })
      ).toBeInTheDocument();
    });

    it('fills in filter-first arguments when selecting avg_if with the feature', async () => {
      render(<Tokens expression="" />);

      const input = screen.getByRole('combobox', {name: 'Add a term'});

      await userEvent.click(input);
      await userEvent.type(input, 'avg_if');
      await userEvent.click(screen.getByRole('option', {name: 'avg_if'}));

      expect(
        await screen.findByRole('row', {
          name: 'avg_if(``,span.duration)',
        })
      ).toBeInTheDocument();
    });

    it('allows selecting function with no arguments using mouse', async () => {
      render(<Tokens expression="" />);

      const input = screen.getByRole('combobox', {
        name: 'Add a term',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);

      // typing should reduce the options avilable in the autocomplete
      expect(screen.getAllByRole('option')).toHaveLength(aggregations.length + 1);
      await userEvent.type(input, 'epm');
      expect(screen.getAllByRole('option')).toHaveLength(1);

      await userEvent.click(screen.getByRole('option', {name: 'epm'}));
      expect(await screen.findByLabelText('epm()')).toBeInTheDocument();

      await waitFor(() => expect(getLastInput()).toHaveFocus());
    });

    it('allows selecting function with no arguments using keyboard', async () => {
      render(<Tokens expression="" />);

      const input = screen.getByRole('combobox', {
        name: 'Add a term',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);

      // typing should reduce the options avilable in the autocomplete
      expect(screen.getAllByRole('option')).toHaveLength(aggregations.length + 1);
      await userEvent.type(input, 'epm');
      expect(screen.getAllByRole('option')).toHaveLength(1);

      await userEvent.type(input, '{ArrowDown}{Enter}');
      expect(await screen.findByLabelText('epm()')).toBeInTheDocument();

      await waitFor(() => expect(getLastInput()).toHaveFocus());
    });

    it('allows selecting parenthesis using mouse', async () => {
      render(<Tokens expression="" />);

      const input = screen.getByRole('combobox', {
        name: 'Add a term',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);

      // typing should reduce the options avilable in the autocomplete
      expect(screen.getAllByRole('option')).toHaveLength(aggregations.length + 1);

      const options = within(screen.getByRole('listbox'));
      await userEvent.click(options.getByTestId('icon-parenthesis'));

      const row = await screen.findByLabelText('open_paren:0');
      expect(within(row).getByTestId('icon-parenthesis')).toBeInTheDocument();

      await waitFor(() => expect(getLastInput()).toHaveFocus());
    });

    it('allows selecting parenthesis using keyboard', async () => {
      render(<Tokens expression="" />);

      const input = screen.getByRole('combobox', {
        name: 'Add a term',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);

      // typing should reduce the options avilable in the autocomplete
      expect(screen.getAllByRole('option')).toHaveLength(aggregations.length + 1);

      await userEvent.type(input, '{ArrowDown}{Enter}');

      const row = await screen.findByRole('row');
      expect(within(row).getByTestId('icon-parenthesis')).toBeInTheDocument();

      await waitFor(() => expect(getLastInput()).toHaveFocus());
    });

    it('autocompletes function token when they reach the open parenthesis', async () => {
      render(<Tokens expression="" />);

      const input = screen.getByRole('combobox', {
        name: 'Add a term',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);
      await userEvent.type(input, 'avg(');

      expect(
        await screen.findByRole('row', {
          name: 'avg(span.duration)',
        })
      ).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByLabelText('Select an attribute')).toHaveFocus();
      });
    });

    it('autocompletes function token when they reach the open parenthesis even if there is more text', async () => {
      render(<Tokens expression="" />);

      const input = screen.getByRole('combobox', {
        name: 'Add a term',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);
      await userEvent.type(input, 'foo bar  avg(');

      expect(
        await screen.findByRole('row', {
          name: 'avg(span.duration)',
        })
      ).toBeInTheDocument();

      expect(input).toHaveValue('foo bar');

      await waitFor(() => {
        expect(screen.getByLabelText('Select an attribute')).toHaveFocus();
      });
    });

    it('autocompletes function token with no arguments when they reach the open parenthesis', async () => {
      render(<Tokens expression="" />);

      const input = screen.getByRole('combobox', {
        name: 'Add a term',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);
      await userEvent.type(input, 'epm(');

      await waitFor(() => expect(getLastInput()).toHaveFocus());
      await userEvent.keyboard('{Escape}');

      expect(
        await screen.findByRole('row', {
          name: 'epm()',
        })
      ).toBeInTheDocument();
    });

    it('autocompletes addition', async () => {
      render(<Tokens expression="" />);

      const input = screen.getByRole('combobox', {
        name: 'Add a term',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);
      await userEvent.type(input, '+');
      await userEvent.keyboard('{Escape}');

      const operator = screen.getByTestId('icon-add');
      expect(operator).toBeInTheDocument();

      await waitFor(() => expect(getLastInput()).toHaveFocus());
    });

    it('autocompletes subtract', async () => {
      render(<Tokens expression="" />);

      const input = screen.getByRole('combobox', {
        name: 'Add a term',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);
      await userEvent.type(input, '-');
      await userEvent.keyboard('{Escape}');

      const operator = screen.getByTestId('icon-subtract');
      expect(operator).toBeInTheDocument();

      await waitFor(() => expect(getLastInput()).toHaveFocus());
    });

    it('autocompletes multiply', async () => {
      render(<Tokens expression="" />);

      const input = screen.getByRole('combobox', {
        name: 'Add a term',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);
      await userEvent.type(input, '*');
      await userEvent.keyboard('{Escape}');

      const operator = screen.getByTestId('icon-multiply');
      expect(operator).toBeInTheDocument();

      await waitFor(() => expect(getLastInput()).toHaveFocus());
    });

    it('autocompletes divide', async () => {
      render(<Tokens expression="" />);

      const input = screen.getByRole('combobox', {
        name: 'Add a term',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);
      await userEvent.type(input, '/');
      await userEvent.keyboard('{Escape}');

      const operator = screen.getByTestId('icon-divide');
      expect(operator).toBeInTheDocument();

      await waitFor(() => expect(getLastInput()).toHaveFocus());
    });

    it('autocompletes open parenthesis', async () => {
      render(<Tokens expression="" />);

      const input = screen.getByRole('combobox', {
        name: 'Add a term',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);
      await userEvent.type(input, '(');
      await userEvent.keyboard('{Escape}');

      const parenthesis = screen.getByTestId('icon-parenthesis');
      expect(parenthesis).toBeInTheDocument();
      expect(parenthesis).toHaveAttribute('data-paren-side', 'left');

      await waitFor(() => expect(getLastInput()).toHaveFocus());
    });

    it('autocompletes close parenthesis', async () => {
      render(<Tokens expression="" />);

      const input = screen.getByRole('combobox', {
        name: 'Add a term',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);
      await userEvent.type(input, ')');
      await userEvent.keyboard('{Escape}');

      const parenthesis = screen.getByTestId('icon-parenthesis');
      expect(parenthesis).toBeInTheDocument();
      expect(parenthesis).toHaveAttribute('data-paren-side', 'right');

      await waitFor(() => expect(getLastInput()).toHaveFocus());
    });

    it('allows selecting reference using mouse', async () => {
      render(<Tokens expression="" references={new Set(['A', 'B'])} />);

      const input = screen.getByRole('combobox', {
        name: 'Add a term',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);

      // 3 originally because of the parens
      expect(screen.getAllByRole('option')).toHaveLength(3);

      await userEvent.click(screen.getByRole('option', {name: 'A'}));

      await waitFor(() => expect(getLastInput()).toHaveFocus());
      await userEvent.type(getLastInput(), '{Escape}');

      expect(await screen.findByRole('row', {name: 'A'})).toBeInTheDocument();
    });

    it('automatically replaces freetext token with reference when typing a match', async () => {
      render(<Tokens expression="" references={new Set(['A', 'B'])} />);

      const input = screen.getByRole('combobox', {
        name: 'Add a term',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);
      expect(screen.getAllByRole('option')).toHaveLength(3);
      expect(screen.getByRole('option', {name: 'A'})).toBeInTheDocument();
      await userEvent.type(input, 'A');

      await waitFor(() => expect(getLastInput()).toHaveFocus());
      await userEvent.type(getLastInput(), '{Escape}');

      expect(await screen.findByRole('row', {name: 'A'})).toBeInTheDocument();
    });
  });

  describe('ArithmeticTokenFunction', () => {
    it('allow changing attribute on click', async () => {
      render(<Tokens expression="avg(span.duration)" />);

      expect(
        await screen.findByRole('row', {
          name: 'avg(span.duration)',
        })
      ).toBeInTheDocument();

      const input = screen.getByRole('combobox', {
        name: 'Select an attribute',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);
      expect(input).toHaveFocus();
      expect(input).toHaveAttribute('placeholder', 'span.duration');
      expect(input).toHaveValue('');

      // typing should reduce the options avilable in the autocomplete
      expect(screen.getAllByRole('option')).toHaveLength(2);
      await userEvent.type(input, 'span.self_time');
      expect(screen.getAllByRole('option')).toHaveLength(1);

      await userEvent.click(screen.getByRole('option', {name: 'span.self_time'}));

      await waitFor(() => expect(getLastInput()).toHaveFocus());
      await userEvent.type(getLastInput(), '{Escape}');

      await waitFor(() => {
        expect(
          screen.getByRole('row', {
            name: 'avg(span.self_time)',
          })
        ).toBeInTheDocument();
      });
    });

    it('allows changing attribute using combo box', async () => {
      render(<Tokens expression="avg(span.duration)" />);

      expect(
        await screen.findByRole('row', {
          name: 'avg(span.duration)',
        })
      ).toBeInTheDocument();

      const input = screen.getByRole('combobox', {
        name: 'Select an attribute',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);
      expect(input).toHaveFocus();
      expect(input).toHaveAttribute('placeholder', 'span.duration');
      expect(input).toHaveValue('');

      // typing should reduce the options avilable in the autocomplete
      expect(screen.getAllByRole('option')).toHaveLength(2);
      await userEvent.type(input, 'span.self_time');
      expect(screen.getAllByRole('option')).toHaveLength(1);

      await userEvent.type(input, '{ArrowDown}{Enter}');

      await waitFor(() => expect(getLastInput()).toHaveFocus());
      await userEvent.type(getLastInput(), '{Escape}');

      expect(
        await screen.findByRole('row', {
          name: 'avg(span.self_time)',
        })
      ).toBeInTheDocument();
    });

    it('allows changing attribute using enter key', async () => {
      render(<Tokens expression="avg(span.duration)" />);

      expect(
        await screen.findByRole('row', {
          name: 'avg(span.duration)',
        })
      ).toBeInTheDocument();

      const input = screen.getByRole('combobox', {
        name: 'Select an attribute',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);
      expect(input).toHaveFocus();
      expect(input).toHaveAttribute('placeholder', 'span.duration');
      expect(input).toHaveValue('');

      // typing should reduce the options avilable in the autocomplete
      expect(screen.getAllByRole('option')).toHaveLength(2);
      await userEvent.type(input, 'span.self_time');
      expect(screen.getAllByRole('option')).toHaveLength(1);

      await userEvent.type(input, '{Enter}');

      const lastInput = getLastInput();
      await waitFor(() => expect(lastInput).toHaveFocus());
      await userEvent.type(lastInput, '{Escape}');

      expect(
        await screen.findByRole('row', {
          name: 'avg(span.self_time)',
        })
      ).toBeInTheDocument();
    });

    it('maps key to suggested key on enter', async () => {
      render(<Tokens expression="avg(span.duration)" />);

      expect(
        await screen.findByRole('row', {
          name: 'avg(span.duration)',
        })
      ).toBeInTheDocument();

      const input = screen.getByRole('combobox', {
        name: 'Select an attribute',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);
      expect(input).toHaveFocus();
      expect(input).toHaveAttribute('placeholder', 'span.duration');
      expect(input).toHaveValue('');

      await userEvent.type(input, 'self_time{Enter}');

      const lastInput = getLastInput();
      await waitFor(() => expect(lastInput).toHaveFocus());
      await userEvent.type(lastInput, '{Escape}');

      expect(
        await screen.findByRole('row', {
          name: 'avg(span.self_time)',
        })
      ).toBeInTheDocument();
    });

    it('doesnt change argument on enter if input is empty', async () => {
      render(<Tokens expression="avg(span.duration)" />);

      expect(
        await screen.findByRole('row', {
          name: 'avg(span.duration)',
        })
      ).toBeInTheDocument();

      const input = screen.getByRole('combobox', {
        name: 'Select an attribute',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);
      expect(input).toHaveFocus();
      expect(input).toHaveAttribute('placeholder', 'span.duration');
      expect(input).toHaveValue('');

      expect(screen.getAllByRole('option')).toHaveLength(2);
      await userEvent.type(input, '{Enter}');

      const lastInput = getLastInput();
      await waitFor(() => expect(lastInput).toHaveFocus());
      await userEvent.type(lastInput, '{Escape}');

      expect(
        await screen.findByRole('row', {
          name: 'avg(span.duration)',
        })
      ).toBeInTheDocument();
    });

    it('can delete function tokens with the delete button', async () => {
      render(<Tokens expression="avg(span.duration)" />);

      expect(
        await screen.findByRole('row', {
          name: 'avg(span.duration)',
        })
      ).toBeInTheDocument();

      await userEvent.click(
        screen.getByRole('button', {
          name: 'Remove function avg(span.duration)',
        })
      );

      expect(
        screen.queryByRole('row', {
          name: 'avg(span.duration)',
        })
      ).not.toBeInTheDocument();
    });

    it('filters only compatible number attributes for some functions', async () => {
      render(<Tokens expression="avg(span.duration)" />);
      const input = screen.getByRole('combobox', {
        name: 'Select an attribute',
      });
      await userEvent.click(input);
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(2);
      expect(options[0]).toHaveTextContent('span.duration');
      expect(options[1]).toHaveTextContent('span.self_time');
      await userEvent.type(input, 'time');
      expect(screen.getByRole('option')).toHaveTextContent('span.self_time');
    });

    it('filters only compatible string attributes for some functions', async () => {
      render(<Tokens expression="count_unique(span.op)" />);
      const input = screen.getByRole('combobox', {
        name: 'Select an attribute',
      });
      await userEvent.click(input);
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(2);
      expect(options[0]).toHaveTextContent('span.op');
      expect(options[1]).toHaveTextContent('span.description');
      await userEvent.type(input, 'desc');
      expect(screen.getByRole('option')).toHaveTextContent('span.description');
    });

    it('shows "spans" placeholder for count argument input', async () => {
      render(<Tokens expression="count(span.duration)" />);

      const input = await screen.findByRole('combobox', {
        name: 'Select an attribute',
      });
      expect(input).toHaveAttribute('placeholder', 'spans');
    });

    it('shows "span.duration" placeholder for avg argument input', async () => {
      render(<Tokens expression="avg(span.duration)" />);

      const input = await screen.findByRole('combobox', {
        name: 'Select an attribute',
      });
      expect(input).toHaveAttribute('placeholder', 'span.duration');
    });

    it('shows "spans" as the dropdown label for count argument', async () => {
      render(<Tokens expression="count(span.duration)" />);

      const input = screen.getByRole('combobox', {
        name: 'Select an attribute',
      });
      await userEvent.click(input);

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(1);
      expect(options[0]).toHaveTextContent('spans');
    });

    it('resolves typed "spans" to "span.duration" for count', async () => {
      const dispatch = jest.fn();
      render(<Tokens expression="count(span.duration)" dispatch={dispatch} />);

      const input = screen.getByRole('combobox', {
        name: 'Select an attribute',
      });

      await userEvent.click(input);
      await userEvent.clear(input);
      await userEvent.type(input, 'spans{Enter}');

      await waitFor(() => {
        expect(dispatch).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'REPLACE_TOKEN',
            text: 'count(span.duration)',
          })
        );
      });
    });

    it('dispatches span.duration when selecting dropdown option for count', async () => {
      const dispatch = jest.fn();
      render(<Tokens expression="count(span.duration)" dispatch={dispatch} />);

      const input = screen.getByRole('combobox', {
        name: 'Select an attribute',
      });
      await userEvent.click(input);
      await userEvent.click(screen.getByRole('option', {name: 'spans'}));

      await waitFor(() => {
        expect(dispatch).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'REPLACE_TOKEN',
            text: 'count(span.duration)',
          })
        );
      });
    });

    it('shows "span.duration" as the dropdown label for avg argument', async () => {
      render(<Tokens expression="avg(span.duration)" />);

      const input = screen.getByRole('combobox', {
        name: 'Select an attribute',
      });
      await userEvent.click(input);

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(2);
      expect(options[0]).toHaveTextContent('span.duration');
      expect(options[1]).toHaveTextContent('span.self_time');
    });

    it('skips input when function has no arguments', async () => {
      render(<Tokens expression="epm()" />);
      await waitFor(() => {
        expect(
          screen.queryByRole('combobox', {
            name: 'Select an attribute',
          })
        ).not.toBeInTheDocument();
      });
    });

    it('renders multi-argument function and allows navigating between arguments', async () => {
      render(<Tokens expression="count_if(span.op,equals,browser)" />);

      expect(
        await screen.findByRole('row', {
          name: 'count_if(span.op,equals,browser)',
        })
      ).toBeInTheDocument();

      const args = within(
        screen.getByRole('grid', {name: 'Enter arguments'})
      ).queryAllByRole('gridcell');

      expect(args).toHaveLength(3);

      const firstArg = within(
        screen.getByRole('grid', {name: 'Enter arguments'})
      ).getByRole('combobox', {name: 'Select an attribute'});

      expect(firstArg).toHaveAttribute('placeholder', 'span.op');

      const secondArg = within(
        screen.getByRole('grid', {name: 'Enter arguments'})
      ).getByRole('combobox', {name: 'Select an option'});
      expect(secondArg).toHaveAttribute('placeholder', 'equals');

      const thirdArg = within(
        screen.getByRole('grid', {name: 'Enter arguments'})
      ).getByRole('textbox', {name: 'Add a value'});
      expect(thirdArg).toHaveValue('browser');

      await userEvent.click(firstArg);
      await userEvent.type(firstArg, 'span.description');
      expect(screen.getByRole('option', {name: 'span.description'})).toBeInTheDocument();
      await userEvent.click(screen.getByRole('option', {name: 'span.description'}));

      await waitFor(() => {
        expect(secondArg).toHaveFocus();
      });

      expect(
        screen.queryByRole('option', {name: 'span.description'})
      ).not.toBeInTheDocument();

      await userEvent.keyboard('not');
      await userEvent.click(screen.getByRole('option', {name: 'is not equal to'}));

      await waitFor(() => {
        expect(thirdArg).toHaveFocus();
      });
      await userEvent.clear(thirdArg);
      await userEvent.type(thirdArg, 'db');
      expect(thirdArg).toHaveValue('db');
    });

    it('keeps filter text when focusing an _if filter argument', async () => {
      render(<Tokens expression="avg_if(`span.op:db`,span.duration)" />);

      expect(
        await screen.findByRole('row', {
          name: 'avg_if(`span.op:db`,span.duration)',
        })
      ).toBeInTheDocument();

      const filterArg = within(
        screen.getByRole('grid', {name: 'Enter arguments'})
      ).getByRole('combobox', {name: 'Add a filter'});
      expect(filterArg).toHaveValue('span.op:db');

      await userEvent.click(filterArg);
      expect(filterArg).toHaveValue('span.op:db');
    });

    it('autocompletes attribute keys in an _if filter argument', async () => {
      render(<Tokens expression="avg_if(``,span.duration)" />);

      expect(
        await screen.findByRole('row', {
          name: 'avg_if(``,span.duration)',
        })
      ).toBeInTheDocument();

      const filterArg = within(
        screen.getByRole('grid', {name: 'Enter arguments'})
      ).getByRole('combobox', {name: 'Add a filter'});

      await userEvent.click(filterArg);
      await userEvent.type(filterArg, 'span.op');
      expect(screen.getByRole('option', {name: 'span.op:'})).toBeInTheDocument();
      await userEvent.click(screen.getByRole('option', {name: 'span.op:'}));

      expect(filterArg).toHaveValue('span.op:');
      expect(filterArg).toHaveFocus();
      // Caret must sit after the colon so value suggestions kick in (Chrome used to
      // reset this when focus returned from the listbox).
      expect(filterArg).toHaveProperty('selectionStart', 'span.op:'.length);
      expect(filterArg).toHaveProperty('selectionEnd', 'span.op:'.length);
    });

    it('switches to value suggestions after selecting a filter key', async () => {
      const getFilterTagValues = jest.fn().mockResolvedValue([{value: 'db'}]);

      render(
        <Tokens
          expression="avg_if(``,span.duration)"
          getFilterTagValues={getFilterTagValues}
        />
      );

      expect(
        await screen.findByRole('row', {
          name: 'avg_if(``,span.duration)',
        })
      ).toBeInTheDocument();

      const filterArg = within(
        screen.getByRole('grid', {name: 'Enter arguments'})
      ).getByRole('combobox', {name: 'Add a filter'});

      await userEvent.click(filterArg);
      await userEvent.type(filterArg, 'span.op');
      await userEvent.click(screen.getByRole('option', {name: 'span.op:'}));

      expect(filterArg).toHaveValue('span.op:');
      await waitFor(() => {
        expect(getFilterTagValues).toHaveBeenCalled();
      });
      expect(await screen.findByRole('option', {name: 'db'})).toBeInTheDocument();
    });

    it('autocompletes tag values in an _if filter argument', async () => {
      const getFilterTagValues = jest.fn(({tag, searchQuery}) => {
        if (tag.key === 'span.op') {
          return Promise.resolve(
            [{value: 'db'}, {value: 'http'}].filter(
              item => !searchQuery || item.value.includes(searchQuery)
            )
          );
        }
        return Promise.resolve([]);
      });

      render(
        <Tokens
          expression="avg_if(``,span.duration)"
          getFilterTagValues={getFilterTagValues}
        />
      );

      expect(
        await screen.findByRole('row', {
          name: 'avg_if(``,span.duration)',
        })
      ).toBeInTheDocument();

      const filterArg = within(
        screen.getByRole('grid', {name: 'Enter arguments'})
      ).getByRole('combobox', {name: 'Add a filter'});

      await userEvent.click(filterArg);
      await userEvent.type(filterArg, 'span.op:');

      await waitFor(() => {
        expect(getFilterTagValues).toHaveBeenCalled();
      });
      expect(await screen.findByRole('option', {name: 'db'})).toBeInTheDocument();
      await userEvent.click(screen.getByRole('option', {name: 'db'}));

      expect(filterArg).toHaveValue('span.op:db');
      expect(filterArg).toHaveFocus();
      await waitFor(() => {
        expect(screen.queryByRole('option')).not.toBeInTheDocument();
      });
    });

    it('continues value autocomplete inside an unclosed quoted value', async () => {
      const getFilterTagValues = jest.fn(({searchQuery}) => {
        return Promise.resolve(
          [{value: 'hello world'}, {value: 'hello there'}].filter(
            item => !searchQuery || item.value.includes(searchQuery)
          )
        );
      });

      render(
        <Tokens
          expression="avg_if(``,span.duration)"
          getFilterTagValues={getFilterTagValues}
        />
      );

      expect(
        await screen.findByRole('row', {
          name: 'avg_if(``,span.duration)',
        })
      ).toBeInTheDocument();

      const filterArg = within(
        screen.getByRole('grid', {name: 'Enter arguments'})
      ).getByRole('combobox', {name: 'Add a filter'});

      await userEvent.click(filterArg);
      await userEvent.type(filterArg, 'span.description:"hello ');

      await waitFor(() => {
        expect(getFilterTagValues).toHaveBeenCalledWith(
          expect.objectContaining({searchQuery: 'hello '})
        );
      });
      expect(
        await screen.findByRole('option', {name: 'hello world'})
      ).toBeInTheDocument();
      await userEvent.click(screen.getByRole('option', {name: 'hello world'}));
      expect(filterArg).toHaveValue('span.description:"hello world"');
    });

    it('shows key autocomplete after a completed value and trailing space', async () => {
      const getFilterTagValues = jest.fn().mockResolvedValue([{value: 'db'}]);

      render(
        <Tokens
          expression="avg_if(``,span.duration)"
          getFilterTagValues={getFilterTagValues}
        />
      );

      expect(
        await screen.findByRole('row', {
          name: 'avg_if(``,span.duration)',
        })
      ).toBeInTheDocument();

      const filterArg = within(
        screen.getByRole('grid', {name: 'Enter arguments'})
      ).getByRole('combobox', {name: 'Add a filter'});

      await userEvent.click(filterArg);
      await userEvent.type(filterArg, 'span.op:db ');

      expect(
        await screen.findByRole('option', {name: 'span.description:'})
      ).toBeInTheDocument();
      expect(screen.queryByRole('option', {name: 'db'})).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('option', {name: 'span.description:'}));
      expect(filterArg).toHaveValue('span.op:db span.description:');
    });

    it('autocompletes keys after a boolean operator in a compound filter', async () => {
      render(<Tokens expression="avg_if(``,span.duration)" />);

      expect(
        await screen.findByRole('row', {
          name: 'avg_if(``,span.duration)',
        })
      ).toBeInTheDocument();

      const filterArg = within(
        screen.getByRole('grid', {name: 'Enter arguments'})
      ).getByRole('combobox', {name: 'Add a filter'});

      await userEvent.click(filterArg);
      await userEvent.type(filterArg, 'span.op:db and ');

      expect(
        await screen.findByRole('option', {name: 'span.description:'})
      ).toBeInTheDocument();
      await userEvent.click(screen.getByRole('option', {name: 'span.description:'}));

      expect(filterArg).toHaveValue('span.op:db and span.description:');
    });

    it('does not show a values dropdown when there are no matching values', async () => {
      const getFilterTagValues = jest.fn().mockResolvedValue([]);

      render(
        <Tokens
          expression="avg_if(``,span.duration)"
          getFilterTagValues={getFilterTagValues}
        />
      );

      expect(
        await screen.findByRole('row', {
          name: 'avg_if(``,span.duration)',
        })
      ).toBeInTheDocument();

      const filterArg = within(
        screen.getByRole('grid', {name: 'Enter arguments'})
      ).getByRole('combobox', {name: 'Add a filter'});

      await userEvent.click(filterArg);
      await userEvent.type(filterArg, 'span.description');
      expect(screen.getByRole('option', {name: 'span.description:'})).toBeInTheDocument();

      await userEvent.type(filterArg, ':');
      await waitFor(() => {
        expect(getFilterTagValues).toHaveBeenCalled();
        expect(screen.queryByRole('option')).not.toBeInTheDocument();
      });
      expect(screen.queryByText('No options found')).not.toBeInTheDocument();
    });

    it('shows filter key suggestions when editing an existing _if filter', async () => {
      const getFilterTagValues = jest.fn().mockResolvedValue([{value: 'db'}]);

      render(
        <Tokens
          expression="avg_if(`span.op:db`,span.duration)"
          getFilterTagValues={getFilterTagValues}
        />
      );

      expect(
        await screen.findByRole('row', {
          name: 'avg_if(`span.op:db`,span.duration)',
        })
      ).toBeInTheDocument();

      const filterArg = within(
        screen.getByRole('grid', {name: 'Enter arguments'})
      ).getByRole('combobox', {name: 'Add a filter'});

      await userEvent.click(filterArg);
      (filterArg as HTMLInputElement).setSelectionRange(0, 0);
      fireEvent.keyUp(filterArg, {key: 'ArrowLeft', code: 'ArrowLeft'});
      await waitFor(() => {
        expect(screen.getByRole('option', {name: 'span.op:'})).toBeInTheDocument();
      });
      expect(screen.queryByRole('option', {name: 'db'})).not.toBeInTheDocument();
    });

    it('shows filter value suggestions when the cursor is after the colon', async () => {
      const getFilterTagValues = jest.fn().mockResolvedValue([{value: 'db'}]);

      render(
        <Tokens
          expression="avg_if(`span.op:db`,span.duration)"
          getFilterTagValues={getFilterTagValues}
        />
      );

      expect(
        await screen.findByRole('row', {
          name: 'avg_if(`span.op:db`,span.duration)',
        })
      ).toBeInTheDocument();

      const filterArg = within(
        screen.getByRole('grid', {name: 'Enter arguments'})
      ).getByRole('combobox', {name: 'Add a filter'});

      await userEvent.click(filterArg);
      (filterArg as HTMLInputElement).setSelectionRange(9, 9);
      fireEvent.keyUp(filterArg, {key: 'ArrowLeft', code: 'ArrowLeft'});

      await waitFor(() => {
        expect(getFilterTagValues).toHaveBeenCalled();
      });
      expect(await screen.findByRole('option', {name: 'db'})).toBeInTheDocument();
      expect(screen.queryByRole('option', {name: 'span.op:'})).not.toBeInTheDocument();
    });

    it('does not open filter autocomplete when clicking the function name', async () => {
      const getFilterTagValues = jest.fn().mockResolvedValue([{value: 'db'}]);

      render(
        <Tokens
          expression="avg_if(`span.op:db`,span.duration)"
          getFilterTagValues={getFilterTagValues}
        />
      );

      const functionRow = await screen.findByRole('row', {
        name: 'avg_if(`span.op:db`,span.duration)',
      });

      await userEvent.click(within(functionRow).getByText('avg_if'));

      expect(
        within(functionRow).getByRole('combobox', {name: 'Add a filter'})
      ).not.toHaveFocus();
      expect(screen.queryByRole('option', {name: 'span.op:'})).not.toBeInTheDocument();
    });

    it('renders filter-first avg_if arguments and allows navigating between them', async () => {
      render(<Tokens expression="avg_if(`span.op:db`,span.duration)" />);

      expect(
        await screen.findByRole('row', {
          name: 'avg_if(`span.op:db`,span.duration)',
        })
      ).toBeInTheDocument();

      const args = within(
        screen.getByRole('grid', {name: 'Enter arguments'})
      ).queryAllByRole('gridcell');

      expect(args).toHaveLength(2);

      const filterArg = within(
        screen.getByRole('grid', {name: 'Enter arguments'})
      ).getByRole('combobox', {name: 'Add a filter'});
      // Filter args are shown without backticks; wrapping is applied on commit.
      expect(filterArg).toHaveValue('span.op:db');

      const columnArg = within(
        screen.getByRole('grid', {name: 'Enter arguments'})
      ).getByRole('combobox', {name: 'Select an attribute'});
      expect(columnArg).toHaveAttribute('placeholder', 'span.duration');

      await userEvent.click(columnArg);
      await userEvent.type(columnArg, 'span.self_time');
      expect(screen.getByRole('option', {name: 'span.self_time'})).toBeInTheDocument();
      await userEvent.click(screen.getByRole('option', {name: 'span.self_time'}));

      await waitFor(() => {
        expect(getLastInput()).toHaveFocus();
      });
      expect(
        screen.queryByRole('option', {name: 'span.self_time'})
      ).not.toBeInTheDocument();
    });

    it('commits _if filter on blur when leaving the equation', async () => {
      const dispatch = jest.fn();
      render(<Tokens expression="avg_if(``,span.duration)" dispatch={dispatch} />);

      expect(
        await screen.findByRole('row', {
          name: 'avg_if(``,span.duration)',
        })
      ).toBeInTheDocument();

      const filterArg = within(
        screen.getByRole('grid', {name: 'Enter arguments'})
      ).getByRole('combobox', {name: 'Add a filter'});

      await userEvent.click(filterArg);
      await userEvent.type(filterArg, 'span.op:db');
      await userEvent.click(getLastInput());

      await waitFor(() => {
        expect(dispatch).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'REPLACE_TOKEN',
            text: 'avg_if(`span.op:db`,span.duration)',
          })
        );
      });
    });

    it('clears _if filter on blur when the filter input is emptied', async () => {
      const dispatch = jest.fn();
      render(
        <Tokens expression="avg_if(`span.op:db`,span.duration)" dispatch={dispatch} />
      );

      expect(
        await screen.findByRole('row', {
          name: 'avg_if(`span.op:db`,span.duration)',
        })
      ).toBeInTheDocument();

      const filterArg = within(
        screen.getByRole('grid', {name: 'Enter arguments'})
      ).getByRole('combobox', {name: 'Add a filter'});

      await userEvent.click(filterArg);
      await userEvent.clear(filterArg);
      await userEvent.click(getLastInput());

      await waitFor(() => {
        expect(dispatch).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'REPLACE_TOKEN',
            text: 'avg_if(``,span.duration)',
          })
        );
      });
    });

    it('clears _if filter on Enter when the filter input is emptied', async () => {
      const dispatch = jest.fn();
      render(
        <Tokens expression="avg_if(`span.op:db`,span.duration)" dispatch={dispatch} />
      );

      expect(
        await screen.findByRole('row', {
          name: 'avg_if(`span.op:db`,span.duration)',
        })
      ).toBeInTheDocument();

      const filterArg = within(
        screen.getByRole('grid', {name: 'Enter arguments'})
      ).getByRole('combobox', {name: 'Add a filter'});

      await userEvent.click(filterArg);
      await userEvent.clear(filterArg);
      await userEvent.keyboard('{Enter}');

      await waitFor(() => {
        expect(dispatch).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'REPLACE_TOKEN',
            text: 'avg_if(``,span.duration)',
          })
        );
      });
    });

    it('does not delete the function when Backspace clears a selected filter', async () => {
      const dispatch = jest.fn();
      render(
        <Tokens expression="avg_if(`span.op:db`,span.duration)" dispatch={dispatch} />
      );

      const filterArg = within(
        await screen.findByRole('grid', {name: 'Enter arguments'})
      ).getByRole('combobox', {name: 'Add a filter'});

      await userEvent.click(filterArg);
      await waitFor(() => {
        expect(filterArg).toHaveValue('span.op:db');
      });
      const filterInput = filterArg as HTMLInputElement;
      filterInput.setSelectionRange(0, filterInput.value.length);
      await userEvent.keyboard('{Backspace}');

      expect(
        screen.getByRole('row', {name: 'avg_if(`span.op:db`,span.duration)'})
      ).toBeInTheDocument();
      expect(dispatch).not.toHaveBeenCalledWith(
        expect.objectContaining({type: 'DELETE_TOKEN'})
      );
    });

    it('does not rewrite the function when moving from filter to another argument', async () => {
      const dispatch = jest.fn();
      render(<Tokens expression="avg_if(``,span.duration)" dispatch={dispatch} />);

      const argsGrid = await screen.findByRole('grid', {name: 'Enter arguments'});
      const filterArg = within(argsGrid).getByRole('combobox', {name: 'Add a filter'});
      const columnArg = within(argsGrid).getByRole('combobox', {
        name: 'Select an attribute',
      });

      await userEvent.click(filterArg);
      await userEvent.type(filterArg, 'span.op:db');
      await userEvent.click(columnArg);

      await waitFor(() => {
        expect(columnArg).toHaveFocus();
      });
      expect(dispatch).not.toHaveBeenCalledWith(
        expect.objectContaining({type: 'REPLACE_TOKEN'})
      );
    });

    it('flushes pending filter edits when leaving the arguments grid', async () => {
      const dispatch = jest.fn();
      render(<Tokens expression="avg_if(``,span.duration)" dispatch={dispatch} />);

      const argsGrid = await screen.findByRole('grid', {name: 'Enter arguments'});
      const filterArg = within(argsGrid).getByRole('combobox', {name: 'Add a filter'});
      const columnArg = within(argsGrid).getByRole('combobox', {
        name: 'Select an attribute',
      });

      await userEvent.click(filterArg);
      await userEvent.type(filterArg, 'span.op:db');
      await userEvent.click(columnArg);
      await waitFor(() => {
        expect(columnArg).toHaveFocus();
      });
      await userEvent.click(getLastInput());

      await waitFor(() => {
        expect(dispatch).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'REPLACE_TOKEN',
            text: 'avg_if(`span.op:db`,span.duration)',
          })
        );
      });
    });

    it('keeps Discover-style avg_if arguments editable when the feature is on', async () => {
      render(<Tokens expression="avg_if(span.duration,span.op,equals,queue.process)" />);

      const argumentsGrid = await screen.findByRole('grid', {name: 'Enter arguments'});

      expect(
        within(argumentsGrid).queryByRole('combobox', {name: 'Add a filter'})
      ).not.toBeInTheDocument();

      const [numberArg, stringArg] = within(argumentsGrid).getAllByRole('combobox', {
        name: 'Select an attribute',
      });
      expect(numberArg).toHaveValue('span.duration');
      expect(stringArg).toHaveValue('span.op');
      expect(
        within(argumentsGrid).getByRole('combobox', {name: 'Select an option'})
      ).toBeInTheDocument();
      expect(
        within(argumentsGrid).getByRole('textbox', {name: 'Add a value'})
      ).toHaveValue('queue.process');
    });

    it('suggests attributes for each argument of avg_if', async () => {
      render(<Tokens expression="avg_if(span.duration,span.op,equals,queue.process)" />);

      const argumentsGrid = await screen.findByRole('grid', {name: 'Enter arguments'});

      const [numberArg, stringArg] = within(argumentsGrid).getAllByRole('combobox', {
        name: 'Select an attribute',
      });
      const conditionArg = within(argumentsGrid).getByRole('combobox', {
        name: 'Select an option',
      });
      const valueArg = within(argumentsGrid).getByRole('textbox', {
        name: 'Add a value',
      });

      await userEvent.click(numberArg!);
      expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual([
        'span.duration',
        'span.self_time',
      ]);

      await userEvent.click(stringArg!);
      expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual([
        'span.op',
        'span.description',
      ]);

      await userEvent.click(conditionArg);
      expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual([
        'is equal to',
        'is not equal to',
      ]);

      expect(valueArg).toHaveValue('queue.process');
    });

    it('suggests column attributes for filter-first avg_if', async () => {
      render(<Tokens expression="avg_if(`span.op:db`,span.duration)" />);

      const argumentsGrid = await screen.findByRole('grid', {name: 'Enter arguments'});

      const filterArg = within(argumentsGrid).getByRole('combobox', {
        name: 'Add a filter',
      });
      const columnArg = within(argumentsGrid).getByRole('combobox', {
        name: 'Select an attribute',
      });

      expect(filterArg).toHaveValue('span.op:db');

      await userEvent.click(columnArg);
      expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual([
        'span.duration',
        'span.self_time',
      ]);
    });
  });

  it('shifts focus between args correctly', async () => {
    render(<Tokens expression="count_if(span.op,equals,browser)" />);

    expect(
      await screen.findByRole('row', {
        name: 'count_if(span.op,equals,browser)',
      })
    ).toBeInTheDocument();

    const args = within(
      screen.getByRole('grid', {name: 'Enter arguments'})
    ).queryAllByRole('gridcell');

    expect(args).toHaveLength(3);

    const firstArg = within(
      screen.getByRole('grid', {name: 'Enter arguments'})
    ).getByRole('combobox', {name: 'Select an attribute'});

    const secondArg = within(
      screen.getByRole('grid', {name: 'Enter arguments'})
    ).getByRole('combobox', {name: 'Select an option'});

    await userEvent.click(firstArg);
    await userEvent.type(firstArg, 'span.description');
    expect(screen.getByRole('option', {name: 'span.description'})).toBeInTheDocument();
    await userEvent.click(screen.getByRole('option', {name: 'span.description'}));

    await waitFor(() => {
      expect(secondArg).toHaveFocus();
    });

    expect(
      screen.queryByRole('option', {name: 'span.description'})
    ).not.toBeInTheDocument();

    await userEvent.click(firstArg);

    await waitFor(() => {
      expect(firstArg).toHaveFocus();
    });
    await userEvent.type(firstArg, 'span.op');
    expect(screen.getByRole('option', {name: 'span.op'})).toBeInTheDocument();
    await userEvent.click(screen.getByRole('option', {name: 'span.op'}));

    await waitFor(() => {
      expect(secondArg).toHaveFocus();
    });

    expect(screen.queryByRole('option', {name: 'span.op'})).not.toBeInTheDocument();
  });

  it('shifts focus between filter-first avg_if args correctly', async () => {
    render(<Tokens expression="avg_if(`span.op:db`,span.duration)" />);

    expect(
      await screen.findByRole('row', {
        name: 'avg_if(`span.op:db`,span.duration)',
      })
    ).toBeInTheDocument();

    const argsGrid = screen.getByRole('grid', {name: 'Enter arguments'});
    expect(within(argsGrid).queryAllByRole('gridcell')).toHaveLength(2);

    const filterArg = within(argsGrid).getByRole('combobox', {
      name: 'Add a filter',
    });
    const columnArg = within(argsGrid).getByRole('combobox', {
      name: 'Select an attribute',
    });

    await userEvent.click(filterArg);
    await waitFor(() => {
      expect(filterArg).toHaveFocus();
    });

    await userEvent.click(columnArg);
    await waitFor(() => {
      expect(columnArg).toHaveFocus();
    });

    await userEvent.click(filterArg);
    await waitFor(() => {
      expect(filterArg).toHaveFocus();
    });
  });

  describe('ArithmeticTokenLiteral', () => {
    it.each(['1', '1.', '1.0', '+1', '+1.', '+1.0', '-1', '-1.', '-1.0'])(
      'renders literal %s',
      async expression => {
        const dispatch = jest.fn();
        render(<Tokens expression={expression} dispatch={dispatch} />);

        expect(await screen.findByRole('row', {name: expression})).toBeInTheDocument();

        const input = screen.getByRole('textbox', {
          name: 'Add a literal',
        });
        expect(input).toBeInTheDocument();
      }
    );

    it('completes literal with space', async () => {
      const dispatch = jest.fn();
      render(<Tokens expression="1" dispatch={dispatch} />);

      expect(await screen.findByRole('row', {name: '1'})).toBeInTheDocument();

      const input = screen.getByRole('textbox', {
        name: 'Add a literal',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);
      expect(input).toHaveFocus();
      expect(input).toHaveValue('1');
      await userEvent.type(input, '0 ');

      await waitFor(() => expect(getLastInput()).toHaveFocus());

      await userEvent.type(getLastInput(), '{Escape}');
      expect(await screen.findByRole('row', {name: '10'})).toBeInTheDocument();
    });

    it('completes literal with enter', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const dispatch = jest.fn();
      render(<Tokens expression="1" dispatch={dispatch} />);

      expect(await screen.findByRole('row', {name: '1'})).toBeInTheDocument();

      const input = screen.getByRole('textbox', {
        name: 'Add a literal',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);
      expect(input).toHaveFocus();
      expect(input).toHaveValue('1');

      await userEvent.type(input, '0');
      await userEvent.type(input, '{Enter}');

      await waitFor(() => expect(getLastInput()).toHaveFocus());

      await userEvent.type(getLastInput(), '{Escape}');
      expect(await screen.findByRole('row', {name: '10'})).toBeInTheDocument();
      errorSpy.mockRestore();
    });

    it('completes literal with escape', async () => {
      const dispatch = jest.fn();
      render(<Tokens expression="1" dispatch={dispatch} />);

      expect(await screen.findByRole('row', {name: '1'})).toBeInTheDocument();

      const input = screen.getByRole('textbox', {
        name: 'Add a literal',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);
      expect(input).toHaveFocus();
      expect(input).toHaveValue('1');
      await userEvent.type(input, '0{escape}');

      expect(await screen.findByRole('row', {name: '10'})).toBeInTheDocument();
    });

    it.each([
      ['+', 'icon-add'],
      ['-', 'icon-subtract'],
      ['*', 'icon-multiply'],
      ['/', 'icon-divide'],
      ['(', 'icon-parenthesis'],
      [')', 'icon-parenthesis'],
    ])('completes literal with token %s', async (token, dataTestId) => {
      const dispatch = jest.fn();
      render(<Tokens expression="1" dispatch={dispatch} />);

      expect(await screen.findByRole('row', {name: '1'})).toBeInTheDocument();

      const input = screen.getByRole('textbox', {
        name: 'Add a literal',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);
      expect(input).toHaveFocus();
      expect(input).toHaveValue('1');
      await userEvent.type(input, '0');
      await userEvent.type(input, token);

      await waitFor(() => expect(getLastInput()).toHaveFocus());
      await userEvent.type(getLastInput(), '{Escape}');

      expect(await screen.findByRole('row', {name: '10'})).toBeInTheDocument();
      expect(screen.getByTestId(dataTestId)).toBeInTheDocument();
    });

    it('completes literal on blur', async () => {
      const dispatch = jest.fn();
      render(<Tokens expression="1" dispatch={dispatch} />);

      expect(await screen.findByRole('row', {name: '1'})).toBeInTheDocument();

      const input = screen.getByRole('textbox', {
        name: 'Add a literal',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);
      expect(input).toHaveFocus();
      expect(input).toHaveValue('1');
      await userEvent.type(input, '00');

      // Tab away to trigger blur without pressing Enter
      await userEvent.tab();

      expect(await screen.findByRole('row', {name: '100'})).toBeInTheDocument();
    });
  });

  describe('ArithmeticTokenOperator', () => {
    it('renders addition operator', async () => {
      const dispatch = jest.fn();
      render(<Tokens expression="+" dispatch={dispatch} />);

      const operator = screen.getByTestId('icon-add');
      expect(operator).toBeInTheDocument();

      await userEvent.click(screen.getByRole('gridcell', {name: 'Delete +'}));
      expect(dispatch).toHaveBeenCalledTimes(2);
      expect(dispatch).toHaveBeenNthCalledWith(1, {
        type: 'DELETE_TOKEN',
        token: expect.objectContaining({
          kind: TokenKind.OPERATOR,
          operator: Operator.PLUS,
        }),
        focusOverride: {
          itemKey: 'str:0',
        },
      });
      expect(dispatch).toHaveBeenNthCalledWith(2, {
        type: 'RESET_FOCUS_OVERRIDE',
      });
    });

    it('renders subtract operator', async () => {
      const dispatch = jest.fn();
      render(<Tokens expression="-" dispatch={dispatch} />);

      const operator = screen.getByTestId('icon-subtract');
      expect(operator).toBeInTheDocument();

      await userEvent.click(screen.getByRole('gridcell', {name: 'Delete -'}));
      expect(dispatch).toHaveBeenCalledTimes(2);
      expect(dispatch).toHaveBeenNthCalledWith(1, {
        type: 'DELETE_TOKEN',
        token: expect.objectContaining({
          kind: TokenKind.OPERATOR,
          operator: Operator.MINUS,
        }),
        focusOverride: {
          itemKey: 'str:0',
        },
      });
      expect(dispatch).toHaveBeenNthCalledWith(2, {
        type: 'RESET_FOCUS_OVERRIDE',
      });
    });

    it('renders multiply operator', async () => {
      const dispatch = jest.fn();
      render(<Tokens expression="*" dispatch={dispatch} />);

      const operator = screen.getByTestId('icon-multiply');
      expect(operator).toBeInTheDocument();

      await userEvent.click(screen.getByRole('gridcell', {name: 'Delete *'}));
      expect(dispatch).toHaveBeenCalledTimes(2);
      expect(dispatch).toHaveBeenNthCalledWith(1, {
        type: 'DELETE_TOKEN',
        token: expect.objectContaining({
          kind: TokenKind.OPERATOR,
          operator: Operator.MULTIPLY,
        }),
        focusOverride: {
          itemKey: 'str:0',
        },
      });
      expect(dispatch).toHaveBeenNthCalledWith(2, {
        type: 'RESET_FOCUS_OVERRIDE',
      });
    });

    it('renders divide operator', async () => {
      const dispatch = jest.fn();
      render(<Tokens expression="/" dispatch={dispatch} />);

      const operator = screen.getByTestId('icon-divide');
      expect(operator).toBeInTheDocument();

      await userEvent.click(screen.getByRole('gridcell', {name: 'Delete /'}));
      expect(dispatch).toHaveBeenCalledTimes(2);
      expect(dispatch).toHaveBeenNthCalledWith(1, {
        type: 'DELETE_TOKEN',
        token: expect.objectContaining({
          kind: TokenKind.OPERATOR,
          operator: Operator.DIVIDE,
        }),
        focusOverride: {
          itemKey: 'str:0',
        },
      });
      expect(dispatch).toHaveBeenNthCalledWith(2, {
        type: 'RESET_FOCUS_OVERRIDE',
      });
    });
  });

  describe('ArithmeticTokenParenthesis', () => {
    it('renders left parenthesis', async () => {
      const dispatch = jest.fn();
      render(<Tokens expression="(" dispatch={dispatch} />);

      const parenthesis = screen.getByTestId('icon-parenthesis');
      expect(parenthesis).toBeInTheDocument();
      expect(parenthesis).toHaveAttribute('data-paren-side', 'left');

      await userEvent.click(screen.getByRole('gridcell', {name: 'Delete left'}));
      expect(dispatch).toHaveBeenCalledTimes(2);
      expect(dispatch).toHaveBeenNthCalledWith(1, {
        type: 'DELETE_TOKEN',
        token: expect.objectContaining({
          kind: TokenKind.OPEN_PARENTHESIS,
          parenthesis: Parenthesis.OPEN,
        }),
        focusOverride: {
          itemKey: 'str:0',
        },
      });
      expect(dispatch).toHaveBeenNthCalledWith(2, {
        type: 'RESET_FOCUS_OVERRIDE',
      });
    });

    it('renders right parenthesis', async () => {
      const dispatch = jest.fn();
      render(<Tokens expression=")" dispatch={dispatch} />);

      const parenthesis = screen.getByTestId('icon-parenthesis');
      expect(parenthesis).toBeInTheDocument();
      expect(parenthesis).toHaveAttribute('data-paren-side', 'right');

      await userEvent.click(screen.getByRole('gridcell', {name: 'Delete right'}));
      expect(dispatch).toHaveBeenCalledTimes(2);
      expect(dispatch).toHaveBeenNthCalledWith(1, {
        type: 'DELETE_TOKEN',
        token: expect.objectContaining({
          kind: TokenKind.CLOSE_PARENTHESIS,
          parenthesis: Parenthesis.CLOSE,
        }),
        focusOverride: {
          itemKey: 'str:0',
        },
      });
      expect(dispatch).toHaveBeenNthCalledWith(2, {
        type: 'RESET_FOCUS_OVERRIDE',
      });
    });
  });
});
