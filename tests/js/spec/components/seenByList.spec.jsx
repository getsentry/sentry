import {mount} from 'sentry-test/enzyme';

import ConfigStore from 'app/stores/configStore';
import SeenByList from 'app/components/seenByList';

describe('SeenByList', function () {
  beforeEach(function () {
    jest.spyOn(ConfigStore, 'get').mockImplementation(() => ({}));
  });

  afterEach(function () {});

  it('should return null if seenBy is falsy', function () {
    const wrapper = mount(<SeenByList />);
    expect(wrapper.children()).toHaveLength(0);
  });

  it('should return a list of each user that saw', function () {
    const wrapper = mount(
      <SeenByList
        seenBy={[
          {id: '1', email: 'jane@example.com'},
          {id: '2', email: 'john@example.com'},
        ]}
      />
    );

    expect(wrapper.find('IconShow')).toHaveLength(1);
    expect(wrapper.find('AvatarList')).toHaveLength(1);
    expect(wrapper.find('UserAvatar')).toHaveLength(2);
  });

  it('filters out the current user from list of users', function () {
    jest
      .spyOn(ConfigStore, 'get')
      .mockImplementation(() => ({id: '1', email: 'jane@example.com'}));

    const wrapper = mount(
      <SeenByList
        seenBy={[
          {id: '1', email: 'jane@example.com'},
          {id: '2', email: 'john@example.com'},
        ]}
      />
    );

    expect(wrapper.find('IconShow')).toHaveLength(1);
    expect(wrapper.find('AvatarList')).toHaveLength(1);
    expect(wrapper.find('UserAvatar')).toHaveLength(1);
    expect(wrapper.find('LetterAvatar').prop('displayName')).toBe('john@example.com');
  });
});
