import {render} from 'sentry-test/reactTestingLibrary';

import PageHeading from 'sentry/components/pageHeading';

describe('PageHeading', function () {
  it('renders', function () {
    const {container} = render(<PageHeading>New Header</PageHeading>);
    expect(container).toSnapshot();
  });
});
