import React from 'react';

import {shallow} from 'sentry-test/enzyme';

import DetailedError from 'app/components/errors/detailedError';

describe('DetailedError', function() {
  it('renders', function() {
    const wrapper = shallow(
      <DetailedError heading="Error heading" message={<div>Message</div>} />
    );

    expect(wrapper).toMatchSnapshot();
  });

  it('renders with "Retry" button', function() {
    const wrapper = shallow(
      <DetailedError
        onRetry={() => {}}
        heading="Error heading"
        message={<div>Message</div>}
      />
    );

    expect(wrapper).toMatchSnapshot();
  });

  it('can hide support links', function() {
    const wrapper = shallow(
      <DetailedError
        hideSupportLinks
        onRetry={() => {}}
        heading="Error heading"
        message={<div>Message</div>}
      />
    );

    expect(wrapper).toMatchSnapshot();
  });

  it('hides footer when no "Retry" and no support links', function() {
    const wrapper = shallow(
      <DetailedError
        hideSupportLinks
        heading="Error heading"
        message={<div>Message</div>}
      />
    );

    expect(wrapper).toMatchSnapshot();
  });
});
