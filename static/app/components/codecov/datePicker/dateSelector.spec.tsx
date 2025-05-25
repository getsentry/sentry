import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DateSelector} from 'sentry/components/codecov/datePicker/dateSelector';

describe('DateSelector', function () {
  it('renders when given relative period', async function () {
    render(<DateSelector relativeDate="7d" onChange={() => {}} />);
    expect(await screen.findByRole('button', {name: '7D'})).toBeInTheDocument();
  });

  it('renders when given an invalid relative period', async function () {
    render(<DateSelector relativeDate="1y" onChange={() => {}} />);
    expect(
      await screen.findByRole('button', {name: 'Invalid Period'})
    ).toBeInTheDocument();
  });
});
