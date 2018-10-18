import {mount} from 'enzyme';
import React from 'react';

import CrashContent from 'app/components/events/interfaces/crashContent';
import {withMeta} from 'app/components/events/meta/metaProxy';

describe('CrashContent', function() {
  let exc = TestStubs.ExceptionWithMeta();
  let event = TestStubs.Event();

  let proxiedExc = withMeta(exc);

  it('renders with meta data', function() {
    let wrapper = mount(
      <CrashContent
        stackView="full"
        stackType="original"
        event={event}
        newestFirst
        exception={proxiedExc.exception}
      />
    );

    expect(wrapper).toMatchSnapshot();
  });
});
