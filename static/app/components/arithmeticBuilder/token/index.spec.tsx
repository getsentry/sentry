import type {Dispatch} from 'react';
import {useCallback} from 'react';

import {
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
import {
  FieldKind,
  FieldValueType,
  getFieldDefinition,
  type AggregateParameter,
} from 'sentry/utils/fields';

const aggregations = ['avg', 'sum', 'epm', 'count_unique', 'count_if'];

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

  // Mock count_if function definition with multiple parameters
  if (key === 'count_if') {
    const parameters: AggregateParameter[] = [
      {
        kind: 'column' as const,
        name: 'column',
        required: true,
        columnTypes: [FieldValueType.STRING, FieldValueType.NUMBER],
      },
      {
        kind: 'dropdown' as const,
        name: 'condition',
        required: true,
        dataType: FieldValueType.STRING,
        options: [
          {value: 'equals', label: 'equals'},
          {value: 'notEquals', label: 'not equals'},
        ],
        defaultValue: 'equals',
      },
      {
        kind: 'value' as const,
        name: 'value',
        required: true,
        dataType: FieldValueType.STRING,
      },
    ];

    return {
      kind: FieldKind.FUNCTION,
      valueType: FieldValueType.INTEGER,
      parameters,
    };
  }

  return getFieldDefinition(key, 'span', argument?.kind);
};

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
}

function Tokens(props: TokensProp) {
  const {state, dispatch} = useArithmeticBuilderAction({
    initialExpression: props.expression,
  });

  const wrappedDispatch = useCallback(
    (action: ArithmeticBuilderAction) => {
      dispatch(action);
      props.dispatch?.(action);
    },
    [dispatch, props]
  );

  return (
    <ArithmeticBuilderContext
      value={{
        dispatch: wrappedDispatch,
        focusOverride: state.focusOverride,
        aggregations,
        functionArguments,
        getFieldDefinition: getSpanFieldDefinition,
        getSuggestedKey,
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
      expect(screen.getAllByRole('option')).toHaveLength(6);
      await userEvent.type(input, 'avg');
      expect(screen.getAllByRole('option')).toHaveLength(1);

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
      expect(screen.getAllByRole('option')).toHaveLength(6);
      await userEvent.type(input, 'avg');
      expect(screen.getAllByRole('option')).toHaveLength(1);

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

    it('allows selecting function with no arguments using mouse', async () => {
      render(<Tokens expression="" />);

      const input = screen.getByRole('combobox', {
        name: 'Add a term',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);

      // typing should reduce the options avilable in the autocomplete
      expect(screen.getAllByRole('option')).toHaveLength(6);
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
      expect(screen.getAllByRole('option')).toHaveLength(6);
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
      expect(screen.getAllByRole('option')).toHaveLength(6);

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
      expect(screen.getAllByRole('option')).toHaveLength(6);

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

      // Should have multiple inputs for each argument - filter to only the function argument inputs
      const functionArgumentInputs = screen
        .getAllByRole('combobox')
        .filter(
          input =>
            input.getAttribute('aria-label') === 'Select an attribute' ||
            input.getAttribute('aria-label') === 'Select an option'
        );
      expect(functionArgumentInputs).toHaveLength(2); // column and condition dropdown (value is a textbox)

      // Check first argument (column)
      expect(functionArgumentInputs[0]).toHaveAttribute('placeholder', 'span.op');

      // Check second argument (condition dropdown)
      expect(functionArgumentInputs[1]).toHaveAttribute('placeholder', 'equals');

      // Test navigation: select option in first argument should focus second argument
      const firstInput = functionArgumentInputs[0]!;
      const secondInput = functionArgumentInputs[1]!;
      const thirdInput = screen.getByRole('textbox', {name: 'Add a value'});

      expect(firstInput).toBeInTheDocument();
      expect(secondInput).toBeInTheDocument();
      expect(thirdInput).toBeInTheDocument();

      await userEvent.click(firstInput);
      await userEvent.type(firstInput, 'span.description');
      expect(screen.getByRole('option', {name: 'span.description'})).toBeInTheDocument();
      await userEvent.click(screen.getByRole('option', {name: 'span.description'}));

      // Should focus the next argument
      await waitFor(() => {
        expect(secondInput).toHaveFocus();
      });

      // Test editing second argument (dropdown)
      await userEvent.click(secondInput);
      expect(screen.getByRole('option', {name: 'equals'})).toBeInTheDocument();
      expect(screen.getByRole('option', {name: 'not equals'})).toBeInTheDocument();

      // Verify the third input exists and is editable
      expect(thirdInput).toBeInTheDocument();
      await userEvent.click(thirdInput);
      await userEvent.type(thirdInput, 'mobile');
      expect(thirdInput).toHaveValue('mobile');
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
