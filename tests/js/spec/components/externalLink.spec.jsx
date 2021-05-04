import {mountWithTheme} from 'sentry-test/enzyme';

import ExternalLink from 'app/components/links/externalLink';

describe('ExternalLink', function () {
  it('renders', function () {
    const wrapper = mountWithTheme(
      <ExternalLink href="https://www.sentry.io/">ExternalLink</ExternalLink>
    );
    expect(wrapper).toSnapshot();
  });
});
