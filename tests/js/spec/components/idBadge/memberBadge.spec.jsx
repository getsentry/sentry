import {mount, shallow} from 'sentry-test/enzyme';

import MemberBadge from 'app/components/idBadge/memberBadge';

describe('MemberBadge', function () {
  let member;
  beforeEach(() => {
    member = TestStubs.Member();
  });

  it('renders with link when member and orgId are supplied', function () {
    const wrapper = mount(<MemberBadge member={member} orgId="orgId" />);

    expect(wrapper.find('StyledName').prop('children')).toBe('Foo Bar');
    expect(wrapper.find('StyledEmail').prop('children')).toBe('foo@example.com');
    expect(wrapper.find('StyledName Link')).toHaveLength(1);
    expect(wrapper.find('StyledAvatar')).toHaveLength(1);
  });

  it('does not use a link when useLink = false', function () {
    const wrapper = mount(<MemberBadge member={member} useLink={false} orgId="orgId" />);

    expect(wrapper.find('StyledName Link')).toHaveLength(0);
  });

  it('does not use a link when orgId = null', function () {
    const wrapper = mount(<MemberBadge member={member} useLink />);

    expect(wrapper.find('StyledName Link')).toHaveLength(0);
  });

  it('can display alternate display names/emails', function () {
    const wrapper = shallow(
      <MemberBadge
        member={member}
        displayName="Other Display Name"
        displayEmail="Other Display Email"
      />
    );

    expect(wrapper.find('StyledName').prop('children')).toBe('Other Display Name');
    expect(wrapper.find('StyledEmail').prop('children')).toBe('Other Display Email');
    expect(wrapper.find('StyledAvatar')).toHaveLength(1);
  });

  it('can coalesce using username', function () {
    member.user = TestStubs.User({
      name: null,
      email: null,
      username: 'the-batman',
    });

    const wrapper = shallow(<MemberBadge member={member} />);

    expect(wrapper.find('StyledName').prop('children')).toBe(member.user.username);
    expect(wrapper.find('StyledEmail').prop('children')).toBe(null);
    expect(wrapper.find('StyledAvatar')).toHaveLength(1);
  });

  it('can coalesce using ipaddress', function () {
    member.user = TestStubs.User({
      name: null,
      email: null,
      username: null,
      ipAddress: '127.0.0.1',
    });
    const wrapper = shallow(<MemberBadge member={member} />);

    expect(wrapper.find('StyledName').prop('children')).toBe(member.user.ipAddress);
    expect(wrapper.find('StyledEmail').prop('children')).toBe(null);
  });

  it('can hide email address', function () {
    const wrapper = mount(<MemberBadge member={member} hideEmail />);

    expect(wrapper.find('StyledEmail')).toHaveLength(0);
  });

  it('renders when a member without a user to passed to member', function () {
    const wrapper = mount(<MemberBadge member={{...member, user: null}} />);

    expect(wrapper.find('StyledName').prop('children')).toBe('Sentry 1 Name');
    expect(wrapper.find('StyledAvatar')).toHaveLength(1);
    expect(wrapper.find('StyledAvatar').prop('user').email).toBe(member.email);
  });
});
