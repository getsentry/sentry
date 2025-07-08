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
import {FieldKind, getFieldDefinition} from 'sentry/utils/fields';

const aggregations = ['avg', 'sum', 'epm', 'count_unique'];

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

describe('token', function () {
  describe('ArithmeticTokenFreeText', function () {
    it('renders default place holder', async function () {
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

    it('allow selecting function using mouse', async function () {
      render(<Tokens expression="" />);

      const input = screen.getByRole('combobox', {
        name: 'Add a term',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);

      // typing should reduce the options avilable in the autocomplete
      expect(screen.getAllByRole('option')).toHaveLength(5);
      await userEvent.type(input, 'avg');
      expect(screen.getAllByRole('option')).toHaveLength(1);

      await userEvent.click(screen.getByRole('option', {name: 'avg'}));

      expect(await screen.findByLabelText('avg(span.duration)')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByLabelText('Select an attribute')).toHaveFocus();
      });
    });

    it('allow selecting function using keyboard', async function () {
      render(<Tokens expression="" />);

      const input = screen.getByRole('combobox', {
        name: 'Add a term',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);
      // typing should reduce the options avilable in the autocomplete
      expect(screen.getAllByRole('option')).toHaveLength(5);
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

    it('allows selecting function with no arguments using mouse', async function () {
      render(<Tokens expression="" />);

      const input = screen.getByRole('combobox', {
        name: 'Add a term',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);

      // typing should reduce the options avilable in the autocomplete
      expect(screen.getAllByRole('option')).toHaveLength(5);
      await userEvent.type(input, 'epm');
      expect(screen.getAllByRole('option')).toHaveLength(1);

      await userEvent.click(screen.getByRole('option', {name: 'epm'}));
      expect(await screen.findByLabelText('epm()')).toBeInTheDocument();

      await waitFor(() => expect(getLastInput()).toHaveFocus());
    });

    it('allows selecting function with no arguments using keyboard', async function () {
      render(<Tokens expression="" />);

      const input = screen.getByRole('combobox', {
        name: 'Add a term',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);

      // typing should reduce the options avilable in the autocomplete
      expect(screen.getAllByRole('option')).toHaveLength(5);
      await userEvent.type(input, 'epm');
      expect(screen.getAllByRole('option')).toHaveLength(1);

      await userEvent.type(input, '{ArrowDown}{Enter}');
      expect(await screen.findByLabelText('epm()')).toBeInTheDocument();

      await waitFor(() => expect(getLastInput()).toHaveFocus());
    });

    it('allows selecting parenthesis using mouse', async function () {
      render(<Tokens expression="" />);

      const input = screen.getByRole('combobox', {
        name: 'Add a term',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);

      // typing should reduce the options avilable in the autocomplete
      expect(screen.getAllByRole('option')).toHaveLength(5);

      const options = within(screen.getByRole('listbox'));
      await userEvent.click(options.getByTestId('icon-parenthesis'));

      const row = await screen.findByLabelText('open_paren:0');
      expect(within(row).getByTestId('icon-parenthesis')).toBeInTheDocument();

      await waitFor(() => expect(getLastInput()).toHaveFocus());
    });

    it('allows selecting parenthesis using keyboard', async function () {
      render(<Tokens expression="" />);

      const input = screen.getByRole('combobox', {
        name: 'Add a term',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);

      // typing should reduce the options avilable in the autocomplete
      expect(screen.getAllByRole('option')).toHaveLength(5);

      await userEvent.type(input, '{ArrowDown}{Enter}');

      const row = await screen.findByRole('row');
      expect(within(row).getByTestId('icon-parenthesis')).toBeInTheDocument();

      await waitFor(() => expect(getLastInput()).toHaveFocus());
    });

    it('autocompletes function token when they reach the open parenthesis', async function () {
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

    it('autocompletes function token when they reach the open parenthesis even if there is more text', async function () {
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

    it('autocompletes function token with no arguments when they reach the open parenthesis', async function () {
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

    it('autocompletes addition', async function () {
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

    it('autocompletes subtract', async function () {
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

    it('autocompletes multiply', async function () {
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

    it('autocompletes divide', async function () {
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

    it('autocompletes open parenthesis', async function () {
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

    it('autocompletes close parenthesis', async function () {
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

  describe('ArithmeticTokenFunction', function () {
    it('allow changing attribute on click', async function () {
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

    it('allows changing attribute using combo box', async function () {
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

    it('allows changing attribute using enter key', async function () {
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

    it('doesnt change argument on enter if input is empty', async function () {
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

    it('can delete function tokens with the delete button', async function () {
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

    it('filters only compatible number attributes for some functions', async function () {
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

    it('filters only compatible string attributes for some functions', async function () {
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

    it('skips input when function has no arguments', async function () {
      render(<Tokens expression="epm()" />);
      await waitFor(() => {
        expect(
          screen.queryByRole('combobox', {
            name: 'Select an attribute',
          })
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('ArithmeticTokenOperator', function () {
    it('renders addition operator', async function () {
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

    it('renders subtract operator', async function () {
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

    it('renders multiply operator', async function () {
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

    it('renders divide operator', async function () {
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

  describe('ArithmeticTokenParenthesis', function () {
    it('renders left parenthesis', async function () {
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

    it('renders right parenthesis', async function () {
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
