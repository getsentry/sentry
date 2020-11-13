import React from 'react';

import {mount} from 'sentry-test/enzyme';

import User from 'app/components/events/contexts/user/user';
import {FILTER_MASK} from 'app/constants';

describe('User', function () {
  it("displays filtered values but doesn't use them for avatar", function () {
    const user1 = {
      id: '26',
      name: FILTER_MASK,
    };

    const wrapper1 = mount(<User data={user1} />);
    expect(wrapper1.find('[data-test-id="user-context-name-value"]').text()).toEqual(
      FILTER_MASK
    );
    expect(wrapper1.find('LetterAvatar').text()).toEqual('?');

    const user2 = {
      id: '26',
      email: FILTER_MASK,
    };

    const wrapper2 = mount(<User data={user2} />);
    expect(wrapper2.find('[data-test-id="user-context-email-value"]').text()).toEqual(
      FILTER_MASK
    );
    expect(wrapper2.find('LetterAvatar').text()).toEqual('?');

    const user3 = {
      id: '26',
      username: FILTER_MASK,
    };

    const wrapper3 = mount(<User data={user3} />);
    expect(wrapper3.find('[data-test-id="user-context-username-value"]').text()).toEqual(
      FILTER_MASK
    );
    expect(wrapper3.find('LetterAvatar').text()).toEqual('?');
  });
});
