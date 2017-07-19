import React from 'react';
import {shallow} from 'enzyme';
import toJson from 'enzyme-to-json';

import DetailedError from 'app/components/errors/detailedError';

describe('DetailedError', function() {
  it('renders', function() {
    let wrapper = shallow(
      <DetailedError heading="Error heading" message={<div>Message</div>} />
    );

    expect(toJson(wrapper)).toMatchSnapshot();
  });

  it('renders with "Retry" button', function() {
    let wrapper = shallow(
      <DetailedError
        onRetry={() => {}}
        heading="Error heading"
        message={<div>Message</div>}
      />
    );

    expect(toJson(wrapper)).toMatchSnapshot();
  });

  it('can hide support links', function() {
    let wrapper = shallow(
      <DetailedError
        hideSupportLinks
        onRetry={() => {}}
        heading="Error heading"
        message={<div>Message</div>}
      />
    );

    expect(toJson(wrapper)).toMatchSnapshot();
  });

  it('hides footer when no "Retry" and no support links', function() {
    let wrapper = shallow(
      <DetailedError
        hideSupportLinks
        heading="Error heading"
        message={<div>Message</div>}
      />
    );

    expect(toJson(wrapper)).toMatchSnapshot();
  });
});
