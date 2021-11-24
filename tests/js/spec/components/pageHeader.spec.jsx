import {mountWithTheme} from 'sentry-test/enzyme';

import PageHeading from 'sentry/components/pageHeading';

describe('PageHeading', function () {
  it('renders', function () {
    const wrapper = mountWithTheme(<PageHeading>New Header</PageHeading>);
    expect(wrapper).toSnapshot();
  });
});
