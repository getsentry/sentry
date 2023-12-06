import {render, screen} from 'sentry-test/reactTestingLibrary';

import CircleIndicator from 'sentry/components/circleIndicator';

describe('CircleIndicator', function () {
  it('renders', async function () {
    render(<CircleIndicator data-test-id="circleIndicator" />);

    expect(await screen.findByTestId('circleIndicator')).toBeInTheDocument();
  });
});
