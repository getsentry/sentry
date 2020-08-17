import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import MutedBox from 'app/components/mutedBox';

describe('MutedBox', function() {
  describe('render()', function() {
    it('handles ignoreUntil', function() {
      const wrapper = mountWithTheme(
        <MutedBox statusDetails={{ignoreUntil: '2017-06-21T19:45:10Z'}} />
      );
      expect(wrapper).toSnapshot();
    });
    it('handles ignoreCount', function() {
      const wrapper = mountWithTheme(<MutedBox statusDetails={{ignoreUserCount: 100}} />);
      expect(wrapper).toSnapshot();
    });
    it('handles ignoreCount with ignoreWindow', function() {
      const wrapper = mountWithTheme(
        <MutedBox statusDetails={{ignoreCount: 100, ignoreWindow: 1}} />
      );
      expect(wrapper).toSnapshot();
    });
    it('handles ignoreUserCount', function() {
      const wrapper = mountWithTheme(<MutedBox statusDetails={{ignoreUserCount: 100}} />);
      expect(wrapper).toSnapshot();
    });
    it('handles ignoreUserCount with ignoreUserWindow', function() {
      const wrapper = mountWithTheme(
        <MutedBox statusDetails={{ignoreUserCount: 100, ignoreUserWindow: 1}} />
      );
      expect(wrapper).toSnapshot();
    });
    it('handles default', function() {
      const wrapper = mountWithTheme(<MutedBox statusDetails={{}} />);
      expect(wrapper).toSnapshot();
    });
  });
});
