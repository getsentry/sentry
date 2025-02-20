import type {Dispatch} from 'react';
import {useCallback} from 'react';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {ArithmeticBuilderAction} from 'sentry/components/arithmeticBuilder/action';
import {useArithmeticBuilderAction} from 'sentry/components/arithmeticBuilder/action';
import {ArithmeticBuilderContext} from 'sentry/components/arithmeticBuilder/context';
import {
  Operator,
  Parenthesis,
  TokenKind,
} from 'sentry/components/arithmeticBuilder/token';
import {TokenGrid} from 'sentry/components/arithmeticBuilder/token/grid';

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
    <ArithmeticBuilderContext.Provider
      value={{
        dispatch: wrappedDispatch,
        focusOverride: state.focusOverride,
        aggregateFunctions: [{name: 'avg'}, {name: 'sum'}, {name: 'count'}],
        functionArguments: [{name: 'span.duration'}, {name: 'span.self_time'}],
      }}
    >
      <TokenGrid tokens={state.expression.tokens} />
    </ArithmeticBuilderContext.Provider>
  );
}

function getLastInput() {
  const input = screen.getAllByRole('combobox', {name: 'Add a term'}).at(-1);

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

    it('allow selecting function on click', async function () {
      render(<Tokens expression="" />);

      const input = screen.getByRole('combobox', {
        name: 'Add a term',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);

      // typing should reduce the options avilable in the autocomplete
      expect(screen.getAllByRole('option')).toHaveLength(3);
      await userEvent.type(input, 'avg');
      expect(screen.getAllByRole('option')).toHaveLength(1);

      await userEvent.click(screen.getByRole('option', {name: 'avg'}));

      expect(
        await screen.findByRole('row', {
          name: 'avg(span.duration)',
        })
      ).toBeInTheDocument();
    });

    it('allow updates free text using combo box', async function () {
      render(<Tokens expression="" />);

      const input = screen.getByRole('combobox', {
        name: 'Add a term',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);
      // typing should reduce the options avilable in the autocomplete
      expect(screen.getAllByRole('option')).toHaveLength(3);
      await userEvent.type(input, 'avg');
      expect(screen.getAllByRole('option')).toHaveLength(1);

      await userEvent.type(input, '{ArrowDown}{Enter}');
      expect(
        await screen.findByRole('row', {
          name: 'avg(span.duration)',
        })
      ).toBeInTheDocument();
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
    });

    it('autocompletes addition', async function () {
      render(<Tokens expression="" />);

      const input = screen.getByRole('combobox', {
        name: 'Add a term',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);
      await userEvent.type(input, '+');

      const operator = screen.getByTestId('icon-add');
      expect(operator).toBeInTheDocument();
    });

    it('autocompletes subtract', async function () {
      render(<Tokens expression="" />);

      const input = screen.getByRole('combobox', {
        name: 'Add a term',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);
      await userEvent.type(input, '-');

      const operator = screen.getByTestId('icon-subtract');
      expect(operator).toBeInTheDocument();
    });

    it('autocompletes multiply', async function () {
      render(<Tokens expression="" />);

      const input = screen.getByRole('combobox', {
        name: 'Add a term',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);
      await userEvent.type(input, '*');

      const operator = screen.getByTestId('icon-multiply');
      expect(operator).toBeInTheDocument();
    });

    it('autocompletes divide', async function () {
      render(<Tokens expression="" />);

      const input = screen.getByRole('combobox', {
        name: 'Add a term',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);
      await userEvent.type(input, '/');

      const operator = screen.getByTestId('icon-divide');
      expect(operator).toBeInTheDocument();
    });

    it('autocompletes open parenthesis', async function () {
      render(<Tokens expression="" />);

      const input = screen.getByRole('combobox', {
        name: 'Add a term',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);
      await userEvent.type(input, '(');

      const parenthesis = screen.getByTestId('icon-parenthesis');
      expect(parenthesis).toBeInTheDocument();
      expect(parenthesis).toHaveAttribute('data-paren-side', 'left');
    });

    it('autocompletes close parenthesis', async function () {
      render(<Tokens expression="" />);

      const input = screen.getByRole('combobox', {
        name: 'Add a term',
      });
      expect(input).toBeInTheDocument();

      await userEvent.click(input);
      await userEvent.type(input, ')');

      const parenthesis = screen.getByTestId('icon-parenthesis');
      expect(parenthesis).toBeInTheDocument();
      expect(parenthesis).toHaveAttribute('data-paren-side', 'right');
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

      const lastInput = getLastInput();
      await waitFor(() => expect(lastInput).toHaveFocus());
      await userEvent.type(lastInput, '{Escape}');

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

      const lastInput = getLastInput();
      await waitFor(() => expect(lastInput).toHaveFocus());
      await userEvent.type(lastInput, '{Escape}');

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
          kind: TokenKind.PARENTHESIS,
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
          kind: TokenKind.PARENTHESIS,
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
