import {mount} from 'sentry-test/enzyme';

import ConfigStore from 'app/stores/configStore';
import withConfig from 'app/utils/withConfig';

describe('withConfig HoC', function () {
  it('adds config prop', function () {
    ConfigStore.init();
    const MyComponent = () => null;
    const Container = withConfig(MyComponent);
    const wrapper = mount(<Container />);
    expect(wrapper.find('MyComponent').prop('config')).toEqual({});
    ConfigStore.set('user', 'foo');
    expect(wrapper.find('MyComponent').prop('config')).toEqual({user: 'foo'});
  });
});
