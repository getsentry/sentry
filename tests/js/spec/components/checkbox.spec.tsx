import {render, screen} from 'sentry-test/reactTestingLibrary';

import Checkbox from 'sentry/components/checkbox';

describe('Checkbox', function () {
  it('renders', async function () {
    const {container} = render(<Checkbox onChange={() => {}} />);

    expect(await screen.findByRole('checkbox')).toBeInTheDocument();
    expect(container).toSnapshot();
  });
});
