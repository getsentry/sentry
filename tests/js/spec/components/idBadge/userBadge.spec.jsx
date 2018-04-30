import React from 'react';
import {mount, shallow} from 'enzyme';

import UserBadge from 'app/components/idBadge/userBadge';

describe('UserBadge', function() {
  let user = TestStubs.User();

  it('renders', function() {
    let wrapper = mount(<UserBadge user={user} />);

    expect(wrapper.find('StyledUserBadge')).toHaveLength(1);
    expect(wrapper.find('StyledName').prop('children')).toBe('Foo Bar');
    expect(wrapper.find('StyledEmail').prop('children')).toBe('foo@example.com');
    expect(wrapper.find('StyledName Link')).toHaveLength(1);
  });

  it('can display alternate display names/emails', function() {
    let wrapper = shallow(
      <UserBadge
        user={user}
        displayName="Other Display Name"
        displayEmail="Other Display Email"
      />
    );

    expect(wrapper.find('StyledName').prop('children')).toBe('Other Display Name');
    expect(wrapper.find('StyledEmail').prop('children')).toBe('Other Display Email');
  });

  it('does not use a link for member name', function() {
    let wrapper = mount(<UserBadge user={user} useLink={false} />);

    expect(wrapper.find('StyledName Link')).toHaveLength(0);
  });

  it('can hide email address', function() {
    let wrapper = mount(<UserBadge user={user} hideEmail />);

    expect(wrapper.find('StyledEmail')).toHaveLength(0);
  });
});
