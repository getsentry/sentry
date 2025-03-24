import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {OnDemandBudgetMode} from 'getsentry/types';
import PayAsYouGoBudgetEdit from 'getsentry/views/onDemandBudgets/payAsYouGoBudgetEdit';

describe('PayAsYouGoBudgetEdit', function () {
  it('renders', function () {
    render(
      <PayAsYouGoBudgetEdit
        payAsYouGoBudget={{
          budgetMode: OnDemandBudgetMode.SHARED,
          sharedMaxBudget: 500_00,
        }}
        setPayAsYouGoBudget={jest.fn()}
      />
    );

    expect(screen.getByText('Pay-as-you-go Budget')).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Pay-as-you-go budget'})).toHaveValue(
      '500'
    );
  });

  it('renders alert when PAYG is 0', function () {
    render(
      <PayAsYouGoBudgetEdit
        payAsYouGoBudget={{budgetMode: OnDemandBudgetMode.SHARED, sharedMaxBudget: 0}}
        setPayAsYouGoBudget={jest.fn()}
      />
    );

    expect(screen.getByText('Pay-as-you-go Budget')).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Pay-as-you-go budget'})).toHaveValue('0');
    expect(
      screen.getByText(
        'Setting this to $0 may result in you losing the ability to fully monitor your applications within Sentry.'
      )
    ).toBeInTheDocument();
  });

  it('handles input edge cases', async function () {
    render(
      <PayAsYouGoBudgetEdit
        payAsYouGoBudget={{budgetMode: OnDemandBudgetMode.SHARED, sharedMaxBudget: 0}}
        setPayAsYouGoBudget={jest.fn()}
      />
    );

    expect(screen.getByText('Pay-as-you-go Budget')).toBeInTheDocument();
    const input = screen.getByRole('textbox', {name: 'Pay-as-you-go budget'});

    await userEvent.type(input, 'a');
    expect(input).toHaveValue('0');

    await userEvent.type(input, '-50');
    expect(input).toHaveValue('0');

    await userEvent.type(input, '-');
    expect(input).toHaveValue('0');

    await userEvent.clear(input);
    await userEvent.type(input, '10e');
    expect(input).toHaveValue('0');

    await userEvent.clear(input);
    await userEvent.type(input, 'e');
    expect(input).toHaveValue('0');

    await userEvent.clear(input);
    await userEvent.type(input, '75..');
    expect(input).toHaveValue('0');

    await userEvent.clear(input);
    await userEvent.type(input, '.');
    expect(input).toHaveValue('0');
  });
});
