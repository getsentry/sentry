import {mountWithTheme} from 'sentry-test/reactTestingLibrary';

import ExternalLink from 'sentry/components/links/externalLink';

describe('ExternalLink', function () {
  it('renders', function () {
    const {container} = mountWithTheme(
      <ExternalLink href="https://www.sentry.io/">ExternalLink</ExternalLink>
    );
    expect(container).toSnapshot();
  });
});
