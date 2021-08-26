import {mountWithTheme} from 'sentry-test/enzyme';

import PlatformList from 'app/components/platformList';

describe('PlatformList', function () {
  const platforms = ['java', 'php', 'javascript', 'cocoa', 'ruby'];

  it('renders max of three icons from platforms', function () {
    const wrapper = mountWithTheme(<PlatformList platforms={platforms} />);
    const icons = wrapper.find('StyledPlatformIcon');
    expect(icons).toHaveLength(3);
  });

  it('renders default if no platforms', function () {
    const wrapper = mountWithTheme(<PlatformList platforms={[]} />);
    const icons = wrapper.find('StyledPlatformIcon');
    expect(icons.first().prop('platform')).toBe('default');
    expect(icons).toHaveLength(1);
  });

  it('displays counter', function () {
    const wrapper = mountWithTheme(<PlatformList platforms={platforms} showCounter />);
    const icons = wrapper.find('StyledPlatformIcon');
    expect(icons).toHaveLength(3);
    const counter = wrapper.find('Counter');
    expect(counter.text()).toEqual('2+');
  });

  it('displays counter according to the max value', function () {
    const max = 2;
    const wrapper = mountWithTheme(
      <PlatformList platforms={platforms} max={max} showCounter />
    );
    const icons = wrapper.find('StyledPlatformIcon');
    expect(icons).toHaveLength(max);
    const counter = wrapper.find('Counter');
    expect(counter.text()).toEqual(`${platforms.length - max}+`);
  });
});
