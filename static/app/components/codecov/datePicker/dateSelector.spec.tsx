import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DateSelector} from 'sentry/components/codecov/datePicker/dateSelector';

describe('DateSelector', function () {
  it('renders when given relative period', async function () {
    render(<DateSelector relative="7d" />);
    expect(await screen.findByRole('button', {name: '7D'})).toBeInTheDocument();
  });

  it('renders when given an invalid relative period', async function () {
    render(<DateSelector relative="1y" />);
    expect(
      await screen.findByRole('button', {name: 'Invalid Period'})
    ).toBeInTheDocument();
  });
});
