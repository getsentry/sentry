import {mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import CircleIndicator from 'sentry/components/circleIndicator';

describe('CircleIndicator', function () {
  it('renders', async function () {
    const {container} = mountWithTheme(
      <CircleIndicator data-test-id="circleIndicator" />
    );

    expect(await screen.findByTestId('circleIndicator')).toBeInTheDocument();
    expect(container).toSnapshot();
  });
});
