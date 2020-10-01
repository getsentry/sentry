import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import DetailedError from 'app/components/errors/detailedError';

describe('DetailedError', function () {
  it('renders', function () {
    const wrapper = mountWithTheme(
      <DetailedError heading="Error heading" message={<div>Message</div>} />
    );

    expect(wrapper).toSnapshot();
  });

  it('renders with "Retry" button', function () {
    const wrapper = mountWithTheme(
      <DetailedError
        onRetry={() => {}}
        heading="Error heading"
        message={<div>Message</div>}
      />
    );

    expect(wrapper).toSnapshot();
  });

  it('can hide support links', function () {
    const wrapper = mountWithTheme(
      <DetailedError
        hideSupportLinks
        onRetry={() => {}}
        heading="Error heading"
        message={<div>Message</div>}
      />
    );

    expect(wrapper).toSnapshot();
  });

  it('hides footer when no "Retry" and no support links', function () {
    const wrapper = mountWithTheme(
      <DetailedError
        hideSupportLinks
        heading="Error heading"
        message={<div>Message</div>}
      />
    );

    expect(wrapper).toSnapshot();
  });
});
