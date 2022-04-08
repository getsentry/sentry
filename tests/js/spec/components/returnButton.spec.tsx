import {render, screen} from 'sentry-test/reactTestingLibrary';

import ReturnButton from 'sentry/components/forms/returnButton';

describe('returnButton', function () {
  it('renders', async function () {
    const {container} = render(<ReturnButton data-test-id="returnButton" />);
    expect(await screen.findByTestId('returnButton')).toBeInTheDocument();
    expect(container).toSnapshot();
  });
});
