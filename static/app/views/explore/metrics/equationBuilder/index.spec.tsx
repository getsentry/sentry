import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {EquationBuilder} from 'sentry/views/explore/metrics/equationBuilder';

describe('EquationBuilder', () => {
  it('takes an equation and represents the equation using the provided reference map', async () => {
    const expression = 'count(metricA) + sum(metricB)';
    const referenceMap = {
      A: 'count(metricA)',
      F: 'sum(metricB)',
    };

    render(
      <EquationBuilder
        expression={expression}
        referenceMap={referenceMap}
        handleExpressionChange={() => {}}
      />
    );

    const tokens = await screen.findAllByRole('row');

    // tokens are flanked by empty text nodes for cursor movement,
    // and '+' is encoded as 'op:0'
    expect(tokens.map(token => token.getAttribute('aria-label'))).toEqual([
      '',
      'A',
      '',
      'op:0',
      '',
      'F',
      '',
    ]);
  });

  it('calls the handleExpressionChange callback when the expression changes', async () => {
    const expression = '';

    const handleExpressionChange = jest.fn();

    render(
      <EquationBuilder
        expression={expression}
        referenceMap={{A: 'count(value,metricA,distribution,none)'}}
        handleExpressionChange={handleExpressionChange}
      />
    );

    // Typing the reference de-references it into the metric call
    await userEvent.type(
      await screen.findByRole('combobox', {name: 'Add a term'}),
      'A * 2'
    );

    expect(handleExpressionChange).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'count(value,metricA,distribution,none) * 2',
      }),
      'A * 2'
    );
  });

  it('allows the expression to be cleared', async () => {
    const expression = 'count(value,metricA,distribution,none)';
    const handleExpressionChange = jest.fn();

    render(
      <EquationBuilder
        expression={expression}
        referenceMap={{A: 'count(value,metricA,distribution,none)'}}
        handleExpressionChange={handleExpressionChange}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Remove reference A'}));

    expect(handleExpressionChange).toHaveBeenCalledWith(
      expect.objectContaining({
        text: '',
      }),
      ''
    );
  });

  it('submits an empty expression when the user types a bunch of spaces', async () => {
    const handleExpressionChange = jest.fn();

    render(
      <EquationBuilder
        expression=""
        referenceMap={{A: 'count(value,metricA,distribution,none)'}}
        handleExpressionChange={handleExpressionChange}
      />
    );

    // Type a bunch of spaces and then enter to submit the expression
    await userEvent.type(
      screen.getByRole('combobox', {name: 'Add a term'}),
      '    {enter}'
    );

    expect(handleExpressionChange).toHaveBeenCalledWith(
      expect.objectContaining({
        text: '',
      }),
      ''
    );
  });
});
