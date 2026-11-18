import {render, screen} from 'sentry-test/reactTestingLibrary';

import {CircleIndicator} from './circleIndicator';

describe('CircleIndicator', () => {
  it('renders', async () => {
    render(<CircleIndicator data-test-id="circleIndicator" />);

    expect(await screen.findByTestId('circleIndicator')).toBeInTheDocument();
  });
});
