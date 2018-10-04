import {mount} from 'enzyme';
import React from 'react';

import {decorateEvent} from 'app/components/events/meta/metaProxy';
import MetaData from 'app/components/events/meta/metaData';

describe('MetaData', function() {
  let exc = TestStubs.ExceptionWithMeta();

  let proxiedExc = decorateEvent(exc);

  it('can get meta data', function() {
    let renderProp = jest.fn(() => null);
    mount(
      <MetaData object={proxiedExc.exception.values[0]} prop="value">
        {renderProp}
      </MetaData>
    );

    expect(
      renderProp
    ).toHaveBeenCalledWith('python err A949AE01EBB07300D62AE0178F0944DD21F8C98C err', {
      len: 29,
      rem: [['device_id', 'p', 11, 51]],
    });
  });

  it('has the right value', function() {
    expect(proxiedExc.exception.values[0].value).toBe(
      'python err A949AE01EBB07300D62AE0178F0944DD21F8C98C err'
    );
  });
});
