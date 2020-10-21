import {mount} from 'sentry-test/enzyme';

import DateTime from 'app/components/dateTime';
import ConfigStore from 'app/stores/configStore';

describe('DateTime', () => {
  const user = {
    ...TestStubs.User(),
    options: {
      clock24Hours: false,
      timezone: 'America/Los_Angeles',
    },
  };
  beforeAll(() => {
    ConfigStore.loadInitialData({user});
  });

  it('renders a date', () => {
    const wrapper = mount(<DateTime date={new Date()} />);
    expect(wrapper.text()).toBe('Oct 16, 2017 7:41:20 PM PDT');
  });

  it('renders a date without seconds', () => {
    const wrapper = mount(<DateTime date={new Date()} seconds={false} />);
    expect(wrapper.text()).toBe('Oct 16, 2017 7:41 PM');
  });

  it('renders timeonly', () => {
    const wrapper = mount(<DateTime date={new Date()} timeOnly />);
    expect(wrapper.text()).toBe('7:41 PM');
  });

  it('renders dateOnly', () => {
    const wrapper = mount(<DateTime date={new Date()} dateOnly />);
    expect(wrapper.text()).toBe('October 16, 2017');
  });

  it('renders shortDate', () => {
    const wrapper = mount(<DateTime date={new Date()} shortDate />);
    expect(wrapper.text()).toBe('10/16/2017');
  });

  it('renders timeAndDate', () => {
    const wrapper = mount(<DateTime date={new Date()} timeAndDate />);
    expect(wrapper.text()).toBe('Oct 16, 7:41 PM');
  });

  it('renders date with forced utc', () => {
    const wrapper = mount(<DateTime date={new Date()} utc />);
    expect(wrapper.text()).toBe('Oct 17, 2017 2:41:20 AM UTC');
  });

  describe('24 Hours', () => {
    beforeAll(() => {
      user.options.clock24Hours = true;
      ConfigStore.set('user', user);
    });

    afterAll(() => {
      user.options.clock24Hours = false;
      ConfigStore.set('user', user);
    });

    it('renders a date', () => {
      const wrapper = mount(<DateTime date={new Date()} />);
      expect(wrapper.text()).toBe('October 16 2017 19:41:20 PDT');
    });

    it('renders timeonly', () => {
      const wrapper = mount(<DateTime date={new Date()} timeOnly />);
      expect(wrapper.text()).toBe('19:41');
    });

    it('renders date with forced utc', () => {
      const wrapper = mount(<DateTime date={new Date()} utc />);
      expect(wrapper.text()).toBe('October 17 2017 02:41:20 UTC');
    });
  });
});
