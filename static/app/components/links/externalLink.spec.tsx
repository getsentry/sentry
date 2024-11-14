import {render} from 'sentry-test/reactTestingLibrary';

import ExternalLink from 'sentry/components/links/externalLink';

describe('ExternalLink', function () {
  it('renders', function () {
    render(<ExternalLink href="https://www.sentry.io/">ExternalLink</ExternalLink>);
  });
});
