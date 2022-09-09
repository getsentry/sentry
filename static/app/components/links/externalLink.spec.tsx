import {render} from 'sentry-test/reactTestingLibrary';

import ExternalLink from 'sentry/components/links/externalLink';

describe('ExternalLink', function () {
  it('renders', function () {
    const {container} = render(
      <ExternalLink href="https://www.sentry.io/">ExternalLink</ExternalLink>
    );
    expect(container).toSnapshot();
  });
});
