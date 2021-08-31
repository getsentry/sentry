import {mountWithTheme} from 'sentry-test/enzyme';

import ExternalLink from 'app/components/links/externalLink';

describe('ExternalLink', function () {
  it('renders', function () {
    const {container} = mountWithTheme(
      <ExternalLink href="https://www.sentry.io/">ExternalLink</ExternalLink>
    );
    expect(container).toSnapshot();
  });
});
