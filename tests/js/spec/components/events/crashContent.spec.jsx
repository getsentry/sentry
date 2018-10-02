import {mount} from 'enzyme';
import React from 'react';

import CrashContent from 'app/components/events/interfaces/crashContent';
import {decorateEvent} from 'app/components/events/meta/metaProxy';

describe('CrashContent', function() {
  let exc = TestStubs.ExceptionWithMeta();
  let event = TestStubs.Event();

  let proxiedExc = decorateEvent(exc);

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
